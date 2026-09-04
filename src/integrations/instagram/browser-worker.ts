import { chromium, type Browser, type Page } from "playwright";
import { loadBusinessConfig } from "@/lib/business-config";
import { env } from "@/lib/env";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import type { LeadProfileInput } from "@/lib/types";

const allowedHosts = new Set(["instagram.com", "www.instagram.com"]);
const blockedUsernameSegments = new Set(["explore", "p", "reel", "reels", "accounts", "about", "direct", "legal", "privacy", "web", "popular"]);

export function assertInstagramUrl(url: string): void {
  const parsed = new URL(url);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(`Blocked navigation outside Instagram allowlist: ${parsed.hostname}`);
  }
}

export async function connectInstagramBrowser(): Promise<Browser | null> {
  if ((await getOperationalAppMode()) === "simulation") {
    return null;
  }

  return chromium.connectOverCDP(env.chromeCdpUrl, { timeout: 5000 });
}

export function hashtagUrl(keyword: string): string {
  const tag = keyword
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  return `https://www.instagram.com/explore/tags/${tag}/`;
}

export function searchUrl(keyword: string): string {
  return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(keyword)}`;
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
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 8000 });
    await page.waitForTimeout(1000);

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
      reason: state.loggedIn ? null : "Instagram não está logado no perfil do Chrome usado pela automação.",
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
  const urls = [hashtagUrl(params.keyword), searchUrl(params.keyword)];
  urls.forEach(assertInstagramUrl);
  const ownUsername = loadBusinessConfig().channels.instagram.handle.replace(/^@/, "").toLowerCase();

  try {
    const usernames: string[] = [];

    for (const url of urls) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3500);

      const loggedOut = await page.evaluate(() => {
        const text = document.body.textContent?.toLowerCase() ?? "";
        return text.includes("criar nova conta") || text.includes("sign up") || text.includes("log in");
      });

      if (loggedOut) {
        throw new Error("Instagram session is not logged in for the Chrome CDP profile.");
      }

      addUsernames(usernames, await collectVisibleUsernames(page, params.maxProfiles * 3), params.maxProfiles, ownUsername);

      if (usernames.length >= params.maxProfiles) {
        break;
      }

      const postUrls = await page.evaluate((limit) => {
        return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/p/"], a[href^="/reel/"]'))
          .map((anchor) => anchor.href)
          .filter((href, index, all) => all.indexOf(href) === index)
          .slice(0, limit);
      }, params.maxProfiles);

      for (const postUrl of postUrls) {
        assertInstagramUrl(postUrl);
        await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(1800);

        const username = (await collectVisibleUsernames(page, 3))[0] ?? null;

        if (username && username.toLowerCase() !== ownUsername && !usernames.includes(username)) {
          usernames.push(username);
        }
        if (usernames.length >= params.maxProfiles) {
          break;
        }
      }
    }

    if (usernames.length < params.maxProfiles) {
      await collectFromInstagramSearchPanel(page, params.keyword, usernames, params.maxProfiles, ownUsername);
    }

    return usernames.slice(0, params.maxProfiles).map((username) => ({
      instagramUsername: `@${username}`,
      country: "Brasil",
      discoverySource: "instagram_browser_search",
      discoveryKeyword: params.keyword,
    }));
  } finally {
    await page.close();
  }
}

async function collectFromInstagramSearchPanel(page: Page, keyword: string, usernames: string[], limit: number, ownUsername: string) {
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1800);

  const searchTrigger = page
    .locator('a[aria-label*="Search"], a[aria-label*="Pesquisar"], button[aria-label*="Search"], button[aria-label*="Pesquisar"], svg[aria-label*="Search"], svg[aria-label*="Pesquisar"]')
    .first();
  await searchTrigger.click({ timeout: 7000 }).catch(() => undefined);
  await page.waitForTimeout(800);

  const searchInput = page
    .locator('input[placeholder="Search"], input[placeholder="Pesquisar"], input[aria-label="Search input"], input[aria-label="Entrada da pesquisa"], input[type="text"]')
    .first();

  if ((await searchInput.count()) > 0) {
    await searchInput.fill(keyword, { timeout: 7000 }).catch(() => undefined);
    await page.waitForTimeout(3500);
    addUsernames(usernames, await collectVisibleUsernames(page, limit * 4), limit, ownUsername);
  }
}

async function collectVisibleUsernames(page: Page, limit: number) {
  return page.evaluate(
    ({ limit, blocked }) => {
      const blockedSet = new Set(blocked);
      const candidates = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((anchor) => {
          try {
            return new URL(anchor.href, window.location.origin).pathname.split("/").filter(Boolean)[0] ?? "";
          } catch {
            return "";
          }
        })
        .filter((segment) => /^[a-zA-Z0-9._]{2,30}$/.test(segment))
        .filter((segment) => !blockedSet.has(segment.toLowerCase()));

      const textCandidates = (document.body.textContent ?? "")
        .match(/@[a-zA-Z0-9._]{2,30}/g)
        ?.map((value) => value.replace(/^@/, "")) ?? [];

      return [...candidates, ...textCandidates]
        .filter((segment, index, all) => all.findIndex((item) => item.toLowerCase() === segment.toLowerCase()) === index)
        .slice(0, limit);
    },
    { limit, blocked: Array.from(blockedUsernameSegments) },
  );
}

function addUsernames(target: string[], candidates: string[], limit: number, ownUsername: string) {
  for (const username of candidates) {
    if (username.toLowerCase() === ownUsername || target.some((item) => item.toLowerCase() === username.toLowerCase())) {
      continue;
    }

    target.push(username);
    if (target.length >= limit) {
      return;
    }
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
  const appMode = await getOperationalAppMode();

  if (appMode !== "pilot" && appMode !== "production") {
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
    await page.goto(params.profileUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.bringToFront();
    await page.waitForTimeout(1800);

    const messageButton = page
      .locator('div[role="button"], button')
      .filter({ hasText: /mensagem|message/i })
      .first();
    await messageButton.click({ timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(1800);

    const textbox = page.locator('div[role="textbox"][contenteditable="true"], textarea').first();
    if ((await textbox.count()) > 0) {
      await textbox.fill(params.message, { timeout: 8000 }).catch(async () => {
        await textbox.click({ timeout: 3000 }).catch(() => undefined);
        await page.keyboard.insertText(params.message);
      });
    }

    if (appMode === "production") {
      const sendButton = page
        .locator('div[role="button"], button')
        .filter({ hasText: /enviar|send/i })
        .last();

      await sendButton.click({ timeout: 10000 });
      await page.waitForTimeout(1200);

      return {
        result: "sent",
        pageUrl: page.url(),
        sentAt: new Date().toISOString(),
        idempotencyKey: params.idempotencyKey,
      };
    }

    return {
      result: "operator_confirmation_required",
      pageUrl: page.url(),
      sentAt: null,
      idempotencyKey: params.idempotencyKey,
    };
  } catch (error) {
    await page.close().catch(() => undefined);
    throw error;
  }
}
