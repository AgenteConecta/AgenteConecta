"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import type { AppMode } from "@/lib/types";

const appModes = new Set<AppMode>(["simulation", "dry_run", "pilot", "production"]);

export async function getOperationalAppMode(): Promise<AppMode> {
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
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirectWithNotice("Supabase não está configurado. Não foi possível alterar o modo.");
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
    redirectWithNotice(`Erro ao alterar modo operacional: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(`Modo operacional alterado para ${labelAppMode(mode)}.`);
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

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
