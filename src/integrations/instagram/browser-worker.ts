import { chromium, type Browser } from "playwright";
import { env } from "@/lib/env";
import type { LeadProfileInput } from "@/lib/types";

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

export function hashtagUrl(keyword: string): string {
  const tag = keyword
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  return `https://www.instagram.com/explore/tags/${tag}/`;
}

export function parseInstagramFollowerCount(input: string): number | undefined {
  const match = input.match(/([\d.,]+)\s*([kKmM]?)\s*(?:followers|seguidores)/i);

  if (!match) {
    return undefined;
  }

  const suffix = match[2].toLowerCase();
  const normalized = suffix ? match[1].replace(",", ".") : match[1].replace(/[.,]/g, "");
  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    return undefined;
  }

  if (suffix === "m") {
    return Math.round(value * 1_000_000);
  }
  if (suffix === "k") {
    return Math.round(value * 1_000);
  }

  return Math.round(value);
}

export async function checkInstagramSession(): Promise<{
  connected: boolean;
  loggedIn: boolean;
  title: string;
  url: string;
  reason: string | null;
}> {
  const browser = await connectInstagramBrowser();
  if (!browser) {
    return {
      connected: false,
      loggedIn: false,
      title: "",
      url: "",
      reason: "Chrome CDP is not available in simulation mode.",
    };
  }

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();

  try {
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const state = await page.evaluate(() => {
      const text = document.body.textContent?.toLowerCase() ?? "";
      const hasLoginShell =
        text.includes("criar nova conta") ||
        text.includes("sign up") ||
        text.includes("log in") ||
        text.includes("entrar");
      const hasAppNavigation =
        text.includes("pesquisar") ||
        text.includes("search") ||
        text.includes("direct") ||
        Boolean(document.querySelector('a[href="/direct/inbox/"], a[href="/explore/"]'));

      return {
        loggedIn: hasAppNavigation && !hasLoginShell,
        hasLoginShell,
        hasAppNavigation,
      };
    });

    return {
      connected: true,
      loggedIn: state.loggedIn,
      title: await page.title(),
      url: page.url(),
      reason: state.loggedIn ? null : "Instagram session appears logged out in the CDP Chrome profile.",
    };
  } finally {
    await page.close();
  }
}

export async function discoverProfilesFromHashtag(params: {
  keyword: string;
  maxProfiles: number;
}): Promise<LeadProfileInput[]> {
  const browser = await connectInstagramBrowser();
  if (!browser) {
    return [];
  }

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();
  const url = hashtagUrl(params.keyword);
  assertInstagramUrl(url);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);

    const loggedOut = await page.evaluate(() => {
      const text = document.body.textContent?.toLowerCase() ?? "";
      return text.includes("criar nova conta") || text.includes("sign up") || text.includes("log in");
    });

    if (loggedOut) {
      throw new Error("Instagram session is not logged in for the Chrome CDP profile.");
    }

    const postUrls = await page.evaluate((limit) => {
      return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/p/"], a[href^="/reel/"]'))
        .map((anchor) => anchor.href)
        .filter((href, index, all) => all.indexOf(href) === index)
        .slice(0, limit);
    }, params.maxProfiles);

    const usernames: string[] = [];

    for (const postUrl of postUrls) {
      assertInstagramUrl(postUrl);
      await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1800);

      const username = await page.evaluate(() => {
        const blocked = new Set(["explore", "p", "reel", "reels", "accounts", "about", "direct"]);
        const candidates = Array.from(document.querySelectorAll<HTMLAnchorElement>('article a[href^="/"], header a[href^="/"]'))
          .map((anchor) => anchor.getAttribute("href") ?? "")
          .map((href) => href.split("/").filter(Boolean)[0] ?? "")
          .filter((segment) => /^[a-zA-Z0-9._]{2,30}$/.test(segment))
          .filter((segment) => !blocked.has(segment))
          .filter((segment) => !["legal", "privacy", "web", "popular"].includes(segment));

        return candidates[0] ?? null;
      });

      if (username && !usernames.includes(username)) {
        usernames.push(username);
      }
    }

    return usernames.slice(0, params.maxProfiles).map((username) => ({
      instagramUsername: `@${username}`,
      country: "Brasil",
      discoverySource: "instagram_hashtag_dry_run",
      discoveryKeyword: params.keyword,
    }));
  } finally {
    await page.close();
  }
}

export async function readInstagramPublicProfile(username: string): Promise<LeadProfileInput> {
  const browser = await connectInstagramBrowser();
  if (!browser) {
    return {
      instagramUsername: username.startsWith("@") ? username : `@${username}`,
      country: "Brasil",
    };
  }

  const normalizedUsername = username.replace(/^@/, "");
  const profileUrl = `https://www.instagram.com/${normalizedUsername}/`;
  assertInstagramUrl(profileUrl);

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();

  try {
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);

    const profile = await page.evaluate(() => {
      const title = document.title
        .replace(/^\(\d+\)\s*/, "")
        .replace("• Instagram photos and videos", "")
        .replace("(@", " @")
        .trim();
      const description =
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
        document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
        "";
      const headerText = (document.querySelector("header")?.textContent ?? "").replace(/\s+/g, " ").slice(0, 700);
      const website = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
        .map((anchor) => anchor.href)
        .find((href) => !href.includes("instagram.com"));

      return {
        title,
        description,
        headerText,
        website,
      };
    });

    const displayName = profile.title && profile.title !== "Instagram" ? profile.title : normalizedUsername;
    const followers = parseInstagramFollowerCount([profile.description, profile.headerText].join(" "));

    return {
      instagramUsername: `@${normalizedUsername}`,
      displayName,
      bio: [profile.description, profile.headerText].filter(Boolean).join(" "),
      website: profile.website,
      followers,
      country: "Brasil",
    };
  } finally {
    await page.close();
  }
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
