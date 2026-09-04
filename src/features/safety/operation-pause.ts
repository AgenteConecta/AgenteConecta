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

export async function setOperationalPause(paused: boolean): Promise<{ ok: boolean; message: string; pause: OperationalPause }> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      message: paused ? "Supabase não está configurado. Não foi possível suspender." : "Supabase não está configurado. Não foi possível retomar.",
      pause: {
        paused: false,
        reason: "Sem pausa operacional",
        source: "none",
      },
    };
  }

  const now = new Date().toISOString();
  const { error: settingsError } = await supabase.from("settings").upsert({
    key: "master_pause",
    value: paused
      ? {
          paused: true,
          reason: "Suspenso imediatamente pelo painel",
          pausedAt: now,
        }
      : {
          paused: false,
          reason: "Retomado pelo painel",
          resumedAt: now,
        },
    updated_at: now,
  });

  if (settingsError) {
    return {
      ok: false,
      message: paused ? `Erro ao suspender: ${settingsError.message}` : `Erro ao retomar: ${settingsError.message}`,
      pause: await getOperationalPause(),
    };
  }

  if (paused) {
    const { error: jobsError } = await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        last_error: "Cancelado pela pausa imediata no painel",
        updated_at: now,
      })
      .in("status", ["queued", "running"])
      .in("type", ["discover_leads", "send_instagram_dm", "schedule_followup"]);

    if (jobsError) {
      return {
        ok: false,
        message: `Pausa ativada, mas houve erro ao cancelar jobs: ${jobsError.message}`,
        pause: await getOperationalPause(),
      };
    }
  }

  return {
    ok: true,
    message: paused ? "Pesquisa e envio suspensos imediatamente. Jobs pendentes foram cancelados." : "Pesquisa e envio retomados.",
    pause: {
      paused,
      reason: paused ? "Suspenso imediatamente pelo painel" : "Retomado pelo painel",
      source: paused ? "settings" : "none",
    },
  };
}

export async function suspendAllWork() {
  const result = await setOperationalPause(true);

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(result.message);
}

export async function resumeAllWork() {
  const result = await setOperationalPause(false);

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(result.message);
}

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
