import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";

export type CopyTemplateScope = "all" | "electricians";

export type CopyTemplates = Record<CopyTemplateScope, string>;

const emptyTemplates: CopyTemplates = {
  all: "",
  electricians: "",
};

const copyTemplateScopes = new Set<CopyTemplateScope>(["all", "electricians"]);
const runtimeSettingsPath = path.join(process.cwd(), ".runtime-settings.json");
const settingsKey = "first_contact_copy_templates";

export async function getCopyTemplates(): Promise<CopyTemplates> {
  const localTemplates = await readLocalCopyTemplates();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return localTemplates;
  }

  const { data, error } = await supabase.from("settings").select("value").eq("key", settingsKey).maybeSingle();

  if (error) {
    return localTemplates;
  }

  const value = data?.value as Partial<CopyTemplates> | null | undefined;
  return normalizeTemplates({
    ...localTemplates,
    ...value,
  });
}

export async function saveCopyTemplate(formData: FormData) {
  "use server";

  const scope = normalizeScope(String(formData.get("scope") ?? "all"));
  const copy = String(formData.get("copy") ?? "").trim();
  const returnTo = getSafeReturnPath(formData);
  const result = await saveCopyTemplateRecord(scope, copy);

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(returnTo, result.message);
}

export async function saveCopyTemplateRecord(scope: CopyTemplateScope, copy: string) {
  const current = await getCopyTemplates();
  const next = normalizeTemplates({
    ...current,
    [scope]: copy.trim(),
  });

  await writeLocalCopyTemplates(next);

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("settings").upsert({
      key: settingsKey,
      value: {
        ...next,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return {
        ok: false,
        message: `Copy salva localmente, mas não no Supabase: ${error.message}`,
      };
    }
  }

  return {
    ok: true,
    message: copy.trim() ? "Copy permanente salva." : "Copy permanente removida.",
  };
}

export async function renderCopyTemplate(template: string, lead: { instagramUsername: string; displayName?: string }) {
  const username = lead.instagramUsername.startsWith("@") ? lead.instagramUsername : `@${lead.instagramUsername}`;
  const displayName = lead.displayName?.replace(/\s*[|•-]\s*Instagram.*$/i, "").trim();
  const name = displayName?.split(" ").filter(Boolean)[0] || username.replace(/^@/, "");

  return template
    .replace(/\{nome\}/gi, name)
    .replace(/\{canal\}/gi, displayName || name)
    .replace(/\{perfil\}/gi, displayName || name)
    .replace(/\{username\}/gi, username)
    .replaceAll("@fulano", username)
    .replaceAll("@usuario", username)
    .replaceAll("@usuário", username);
}

async function readLocalCopyTemplates(): Promise<CopyTemplates> {
  try {
    const raw = await readFile(runtimeSettingsPath, "utf8");
    const settings = JSON.parse(raw) as { copyTemplates?: Partial<CopyTemplates> };
    return normalizeTemplates(settings.copyTemplates ?? {});
  } catch {
    return emptyTemplates;
  }
}

async function writeLocalCopyTemplates(copyTemplates: CopyTemplates) {
  let settings: Record<string, unknown> = {};

  try {
    settings = JSON.parse(await readFile(runtimeSettingsPath, "utf8")) as Record<string, unknown>;
  } catch {
    settings = {};
  }

  await writeFile(
    runtimeSettingsPath,
    `${JSON.stringify(
      {
        ...settings,
        copyTemplates,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function normalizeTemplates(value: Partial<CopyTemplates>): CopyTemplates {
  return {
    all: typeof value.all === "string" ? value.all : "",
    electricians: typeof value.electricians === "string" ? value.electricians : "",
  };
}

function normalizeScope(value: string): CopyTemplateScope {
  return copyTemplateScopes.has(value as CopyTemplateScope) ? (value as CopyTemplateScope) : "all";
}

function getSafeReturnPath(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "/");

  return returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}

function redirectWithNotice(returnTo: string, notice: string): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}notice=${encodeURIComponent(notice)}`);
}
