"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendInitialInstagramDm } from "@/integrations/instagram/browser-worker";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { env } from "@/lib/env";

type PendingOutreachMessage = {
  id: string;
  lead_id: string;
  body: string;
  result: string | null;
  leads:
    | {
        instagram_username: string | null;
        do_not_contact: boolean | null;
      }
    | Array<{
        instagram_username: string | null;
        do_not_contact: boolean | null;
      }>
    | null;
};

export async function getApprovedOutreachCount() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return 0;
  }

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("channel", "browser")
    .eq("direction", "outbound")
    .eq("message_variant", "first_contact_approved")
    .in("result", ["dry_run_prepared_not_sent", "queued_for_operator_confirmation", "send_failed"]);

  return count ?? 0;
}

export async function processApprovedOutreach(formData: FormData) {
  const maxMessagesRaw = Number(formData.get("maxMessages") ?? 5);
  const maxMessages = Math.max(1, Math.min(Number.isFinite(maxMessagesRaw) ? maxMessagesRaw : 5, 10));

  if (env.masterPause) {
    redirectWithNotice("Pausa geral ativa. Nenhum contato foi processado.");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirectWithNotice("Supabase não está configurado. Nenhum contato foi processado.");
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, lead_id, body, result, leads(instagram_username, do_not_contact)")
    .eq("channel", "browser")
    .eq("direction", "outbound")
    .eq("message_variant", "first_contact_approved")
    .in("result", ["dry_run_prepared_not_sent", "queued_for_operator_confirmation", "send_failed"])
    .order("created_at", { ascending: true })
    .limit(maxMessages);

  if (error) {
    redirectWithNotice(`Erro ao buscar contatos aprovados: ${error.message}`);
  }

  let processed = 0;
  let blocked = 0;
  let failed = 0;

  for (const message of ((data ?? []) as PendingOutreachMessage[])) {
    const lead = Array.isArray(message.leads) ? message.leads[0] : message.leads;
    const username = lead?.instagram_username;

    if (!username || lead?.do_not_contact) {
      blocked += 1;
      await markMessageResult(message.id, message.lead_id, "blocked_do_not_contact", "Contato bloqueado por ausência de username ou do-not-contact.");
      continue;
    }

    const profileUrl = `https://www.instagram.com/${username.replace(/^@/, "")}/`;
    const idempotencyKey = `instagram-first-contact:${message.id}`;

    try {
      const result = await sendInitialInstagramDm({
        profileUrl,
        message: message.body,
        idempotencyKey,
      });
      const sentAt = result.sentAt ? new Date(result.sentAt).toISOString() : null;

      await supabase
        .from("messages")
        .update({
          result: result.result,
          page_url: result.pageUrl,
          sent_at: sentAt,
        })
        .eq("id", message.id);

      await supabase
        .from("leads")
        .update({
          channel_state: result.result === "dry_run_blocked" ? "outreach_prepared" : "operator_confirmation_required",
          updated_at: new Date().toISOString(),
        })
        .eq("id", message.lead_id);

      await supabase.from("lead_events").insert({
        lead_id: message.lead_id,
        event_type: "outreach_send_processed",
        summary:
          result.result === "dry_run_blocked"
            ? `Contato de @${username} validado, mas não enviado por dry-run.`
            : `Perfil @${username} aberto para confirmação operacional de envio.`,
        payload: {
          messageId: message.id,
          pageUrl: result.pageUrl,
          result: result.result,
          appMode: env.appMode,
        },
      });

      processed += 1;
    } catch (sendError) {
      failed += 1;
      const detail = sendError instanceof Error ? sendError.message : "Erro desconhecido ao processar contato.";
      await markMessageResult(message.id, message.lead_id, "send_failed", detail);
    }
  }

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(`Envio processado: ${processed} preparados, ${blocked} bloqueados, ${failed} falhas. Modo atual: ${env.appMode}.`);
}

async function markMessageResult(messageId: string, leadId: string, result: string, summary: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  await supabase.from("messages").update({ result }).eq("id", messageId);
  await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: "outreach_send_processed",
    summary,
    payload: {
      messageId,
      result,
      appMode: env.appMode,
    },
  });
}

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
