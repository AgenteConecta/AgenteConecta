import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { env } from "@/lib/env";
import { assertInstagramUrl, checkInstagramSession, connectInstagramBrowser } from "@/integrations/instagram/browser-worker";

const defaultInstagramUrl = "https://www.instagram.com/";

function chromeCandidates() {
  return [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "chrome.exe",
  ].filter(Boolean) as string[];
}

function chromeRemoteDebuggingPort() {
  try {
    return new URL(env.chromeCdpUrl).port || "9222";
  } catch {
    return "9222";
  }
}

function resolveChromePath() {
  const candidates = chromeCandidates();
  return candidates.find((candidate) => candidate === "chrome.exe" || existsSync(candidate)) ?? null;
}

export async function launchChromeForInstagram() {
  const chromePath = resolveChromePath();

  if (!chromePath) {
    throw new Error("Chrome não foi encontrado. Configure CHROME_PATH ou instale o Google Chrome.");
  }

  const profileDir = join(process.cwd(), ".chrome-profile");
  await mkdir(profileDir, { recursive: true });

  const child = spawn(
    chromePath,
    [
      `--remote-debugging-port=${chromeRemoteDebuggingPort()}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      defaultInstagramUrl,
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    },
  );

  child.unref();

  return {
    profileDir,
    chromePath,
    chromeCdpUrl: env.chromeCdpUrl,
  };
}

export async function openInstagramInConnectedChrome() {
  assertInstagramUrl(defaultInstagramUrl);
  const browser = await connectInstagramBrowser();

  if (!browser) {
    await launchChromeForInstagram();
    return {
      opened: true,
      connected: false,
      message: "Chrome aberto. Faça login no Instagram e clique em Verificar conexão.",
    };
  }

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();
  await page.goto(defaultInstagramUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  return {
    opened: true,
    connected: true,
    message: "Instagram aberto no Chrome conectado.",
  };
}

export async function getChromeInstagramStatus() {
  try {
    return await Promise.race([
      checkInstagramSession(),
      new Promise<Awaited<ReturnType<typeof checkInstagramSession>>>((resolve) => {
        setTimeout(
          () =>
            resolve({
              connected: false,
              loggedIn: false,
              title: "",
              url: "",
              reason: "A verificação demorou demais. Clique em Conectar Chrome ou Abrir Instagram.",
            }),
          10000,
        );
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isConnectionError =
      message.includes("ECONNREFUSED") ||
      message.includes("connect") ||
      message.includes("CDP") ||
      message.includes("browserType.connectOverCDP");
    const isClosedPage = message.includes("Target page") || message.includes("browser has been closed") || message.includes("context") || message.includes("closed");

    return {
      connected: false,
      loggedIn: false,
      title: "",
      url: "",
      reason: isConnectionError
        ? "Chrome ainda não está conectado na porta 9222."
        : isClosedPage
          ? "Chrome foi encontrado, mas a aba fechou antes da verificação. Clique em Abrir Instagram."
          : message,
    };
  }
}
