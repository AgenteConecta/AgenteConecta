import { chromium, type Browser } from "playwright";
import { env } from "@/lib/env";

const allowedHosts = new Set(["instagram.com", "www.instagram.com"]);

export function assertInstagramUrl(url: string): void {
  const parsed = new URL(url);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(`Blocked navigation outside Instagram allowlist: ${parsed.hostname}`);
  }
}

export async function connectInstagramBrowser(): Promise<Browser | null> {
  if (env.appMode === "simulation") {
    return null;
  }

  return chromium.connectOverCDP(env.chromeCdpUrl);
}

export async function sendInitialInstagramDm(params: {
  profileUrl: string;
  message: string;
  idempotencyKey: string;
}) {
  assertInstagramUrl(params.profileUrl);

  if (env.appMode !== "pilot" && env.appMode !== "production") {
    return {
      result: "dry_run_blocked",
      pageUrl: params.profileUrl,
      sentAt: null,
      idempotencyKey: params.idempotencyKey,
    };
  }

  const browser = await connectInstagramBrowser();
  if (!browser) {
    throw new Error("Chrome CDP browser is not connected");
  }

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();
  try {
    await page.goto(params.profileUrl, { waitUntil: "domcontentloaded" });
    return {
      result: "operator_confirmation_required",
      pageUrl: page.url(),
      sentAt: null,
      idempotencyKey: params.idempotencyKey,
    };
  } finally {
    await page.close();
  }
}
