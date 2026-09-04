"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { env } from "@/lib/env";

export type OperationalPause = {
  paused: boolean;
  reason: string;
  source: "env" | "settings" | "none";
};

export async function getOperationalPause(): Promise<OperationalPause> {
  if (env.masterPause) {
    return {
      paused: true,
      reason: "MASTER_PAUSE ativo no ambiente",
      source: "env",
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      paused: false,
      reason: "Sem pausa operacional",
      source: "none",
    };
  }

  const { data } = await supabase.from("settings").select("value").eq("key", "master_pause").maybeSingle();
  const value = data?.value as { paused?: boolean; reason?: string } | null | undefined;

  return {
    paused: Boolean(value?.paused),
    reason: value?.reason ?? "Pausa operacional pelo painel",
    source: value?.paused ? "settings" : "none",
  };
}

export async function isOperationallyPaused() {
  return (await getOperationalPause()).paused;
}

export async function suspendAllWork() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirectWithNotice("Supabase não está configurado. Não foi possível suspender.");
  }

  const { error: settingsError } = await supabase.from("settings").upsert({
    key: "master_pause",
    value: {
      paused: true,
      reason: "Suspenso imediatamente pelo painel",
      pausedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });

  if (settingsError) {
    redirectWithNotice(`Erro ao suspender: ${settingsError.message}`);
  }

  const { error: jobsError } = await supabase
    .from("jobs")
    .update({
      status: "cancelled",
      last_error: "Cancelado pela pausa imediata no painel",
      updated_at: new Date().toISOString(),
    })
    .in("status", ["queued", "running"])
    .in("type", ["discover_leads", "send_instagram_dm", "schedule_followup"]);

  if (jobsError) {
    redirectWithNotice(`Pausa ativada, mas houve erro ao cancelar jobs: ${jobsError.message}`);
  }

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice("Pesquisa e envio suspensos imediatamente. Jobs pendentes foram cancelados.");
}

export async function resumeAllWork() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirectWithNotice("Supabase não está configurado. Não foi possível retomar.");
  }

  const { error } = await supabase.from("settings").upsert({
    key: "master_pause",
    value: {
      paused: false,
      reason: "Retomado pelo painel",
      resumedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirectWithNotice(`Erro ao retomar: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice("Pesquisa e envio retomados.");
}

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
