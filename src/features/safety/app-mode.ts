"use server";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import type { AppMode } from "@/lib/types";

const appModes = new Set<AppMode>(["simulation", "dry_run", "pilot", "production"]);
const runtimeSettingsPath = path.join(process.cwd(), ".runtime-settings.json");

export async function getOperationalAppMode(): Promise<AppMode> {
  const localMode = await readLocalAppMode();

  if (localMode) {
    return localMode;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return normalizeAppMode(env.appMode);
  }

  const { data } = await supabase.from("settings").select("value").eq("key", "app_mode").maybeSingle();
  const value = data?.value as { mode?: string } | null | undefined;

  return normalizeAppMode(value?.mode ?? env.appMode);
}

export async function updateOperationalAppMode(formData: FormData) {
  const mode = normalizeAppMode(String(formData.get("mode") ?? "dry_run"));
  const result = await setOperationalAppMode(mode);

  if (!result.ok) {
    redirectWithNotice(result.message);
  }

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(`Modo operacional alterado para ${labelAppMode(mode)}.`);
}

export async function setOperationalAppMode(modeInput: string): Promise<{ ok: true; mode: AppMode } | { ok: false; message: string }> {
  const mode = normalizeAppMode(modeInput);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    await writeLocalAppMode(mode);
    return {
      ok: true,
      mode,
    };
  }

  const { error } = await supabase.from("settings").upsert(
    {
      key: "app_mode",
      value: {
        mode,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    await writeLocalAppMode(mode);
    return {
      ok: true,
      mode,
    };
  }

  await writeLocalAppMode(mode);

  return {
    ok: true,
    mode,
  };
}

export async function labelOperationalAppMode(mode: AppMode) {
  return labelAppMode(mode);
}

function normalizeAppMode(value: string): AppMode {
  return appModes.has(value as AppMode) ? (value as AppMode) : "dry_run";
}

function labelAppMode(mode: AppMode) {
  if (mode === "pilot") {
    return "pilot";
  }
  if (mode === "production") {
    return "production";
  }
  if (mode === "simulation") {
    return "simulation";
  }

  return "dry-run";
}

async function readLocalAppMode(): Promise<AppMode | null> {
  try {
    const raw = await readFile(runtimeSettingsPath, "utf8");
    const settings = JSON.parse(raw) as { appMode?: string };
    return settings.appMode ? normalizeAppMode(settings.appMode) : null;
  } catch {
    return null;
  }
}

async function writeLocalAppMode(mode: AppMode) {
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
        appMode: mode,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
