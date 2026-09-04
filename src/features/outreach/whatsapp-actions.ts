import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { isOperationallyPaused } from "@/features/safety/operation-pause";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import { sendEvolutionMessage } from "@/integrations/evolution/evolution-client";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import type { LeadProfileInput, LeadScoreResult } from "@/lib/types";

type WhatsAppLeadRow = {
  id: string;
  instagram_username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  discovery_keyword: string | null;
  lead_score: number | null;
  commercial_value_score: number | null;
  lead_type: string | null;
  market_awareness: string | null;
  do_not_contact: boolean | null;
};

export type WhatsAppSendResult = {
  ok: boolean;
  message: string;
  mode: "dry_run" | "live";
  result: string;
};

export function normalizeWhatsAppPhone(input: string) {
  const digits = input.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

export async function sendWhatsAppForLead(params: {
  leadId: string;
  phone: string;
  message?: string;
}): Promise<WhatsAppSendResult> {
  const supabase = getSupabaseAdminClient();
  const appMode = await getOperationalAppMode();

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase não está configurado.",
      mode: "dry_run",
      result: "failed",
    };
  }

  if (await isOperationallyPaused()) {
    return {
      ok: false,
      message: "Pausa geral ativa. Nenhuma mensagem foi enviada.",
      mode: "dry_run",
      result: "paused",
    };
  }

  const phone = normalizeWhatsAppPhone(params.phone);

  if (phone.length < 12) {
    return {
      ok: false,
      message: "Informe um WhatsApp válido com DDD.",
      mode: "dry_run",
      result: "invalid_phone",
    };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("id, instagram_username, display_name, bio, city, state, phone, discovery_keyword, lead_score, commercial_value_score, lead_type, market_awareness, do_not_contact")
    .eq("id", params.leadId)
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Lead não encontrado.",
      mode: "dry_run",
      result: "failed",
    };
  }

  const lead = data as WhatsAppLeadRow;

  if (lead.do_not_contact) {
    return {
      ok: false,
      message: "Lead marcado como não contatar.",
      mode: "dry_run",
      result: "blocked_do_not_contact",
    };
  }

  const body = params.message?.trim() || generateFirstContactMessage(toLeadInput(lead, phone), toLeadScore(lead));
  const conversationExternalId = `whatsapp:${phone}`;
  const conversation = await supabase
    .from("conversations")
    .upsert(
      {
        lead_id: lead.id,
        channel: "whatsapp",
        external_conversation_id: conversationExternalId,
        status: "open",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel,external_conversation_id" },
    )
    .select("id")
    .single();

  if (conversation.error) {
    return {
      ok: false,
      message: conversation.error.message,
      mode: "dry_run",
      result: "failed",
    };
  }

  const sendResult = await sendEvolutionMessage({
    leadId: lead.id,
    phone,
    message: body,
  }).catch((sendError: unknown) => ({
    provider: "evolution" as const,
    mode: "dry_run" as const,
    externalId: null,
    errorMessage: sendError instanceof Error ? sendError.message : "Falha ao enviar pelo Evolution.",
  }));
  const failed = "errorMessage" in sendResult;
  const result = failed ? "send_failed" : sendResult.mode === "live" ? "sent" : "dry_run_prepared_not_sent";
  const sentAt = result === "sent" ? new Date().toISOString() : null;

  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversation.data.id,
    lead_id: lead.id,
    channel: "whatsapp",
    direction: "outbound",
    body,
    message_variant: "whatsapp_first_contact",
    provider_message_id: failed ? null : sendResult.externalId,
    result,
    sent_at: sentAt,
  });

  if (messageError) {
    return {
      ok: false,
      message: messageError.message,
      mode: failed ? "dry_run" : sendResult.mode,
      result: "failed",
    };
  }

  await supabase
    .from("leads")
    .update({
      phone,
      channel_state: result === "sent" ? "whatsapp_contacted" : "whatsapp_prepared",
      channel_owner: "whatsapp",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  await supabase.from("lead_events").insert({
    lead_id: lead.id,
    event_type: result === "sent" ? "whatsapp_message_sent" : result,
    summary:
      result === "sent"
        ? `WhatsApp enviado para +${phone}.`
        : failed
          ? `Falha ao enviar WhatsApp para +${phone}: ${sendResult.errorMessage}`
          : `WhatsApp preparado para +${phone}; envio real exige modo Produção e Evolution ativo.`,
    payload: {
      phone,
      appMode,
      result,
      provider: "evolution",
    },
  });

  if (failed) {
    return {
      ok: false,
      message: `Falha ao enviar pelo Evolution: ${sendResult.errorMessage}`,
      mode: "dry_run",
      result,
    };
  }

  return {
    ok: true,
    message: sendResult.mode === "live" ? "WhatsApp enviado e registrado no CRM." : "WhatsApp registrado no CRM. Em Produção, será enviado pelo Evolution.",
    mode: sendResult.mode,
    result,
  };
}

export async function recordEvolutionInboundMessage(params: {
  phone: string;
  displayName: string | null;
  text: string;
  providerMessageId: string | null;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      reason: "Supabase não configurado",
    };
  }

  const phone = normalizeWhatsAppPhone(params.phone);
  const { data: lead } = await supabase.from("leads").select("id").eq("phone", phone).maybeSingle();

  if (!lead?.id) {
    return {
      ok: false,
      reason: "Nenhum lead encontrado para esse telefone",
      phone,
    };
  }

  const conversation = await supabase
    .from("conversations")
    .upsert(
      {
        lead_id: lead.id,
        channel: "whatsapp",
        external_conversation_id: `whatsapp:${phone}`,
        status: "open",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel,external_conversation_id" },
    )
    .select("id")
    .single();

  if (conversation.error) {
    return {
      ok: false,
      reason: conversation.error.message,
      phone,
    };
  }

  await supabase.from("messages").upsert(
    {
      conversation_id: conversation.data.id,
      lead_id: lead.id,
      channel: "whatsapp",
      direction: "inbound",
      body: params.text,
      provider_message_id: params.providerMessageId,
      result: "received",
      received_at: new Date().toISOString(),
    },
    { onConflict: "channel,provider_message_id" },
  );

  await supabase
    .from("leads")
    .update({
      channel_state: "whatsapp_replied",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  await supabase.from("lead_events").insert({
    lead_id: lead.id,
    event_type: "whatsapp_reply_received",
    summary: `Resposta recebida no WhatsApp${params.displayName ? ` de ${params.displayName}` : ""}.`,
    payload: {
      phone,
      text: params.text,
      providerMessageId: params.providerMessageId,
    },
  });

  return {
    ok: true,
    phone,
    leadId: lead.id as string,
  };
}

function toLeadInput(lead: WhatsAppLeadRow, phone: string): LeadProfileInput {
  return {
    instagramUsername: lead.instagram_username ? `@${lead.instagram_username}` : `+${phone}`,
    displayName: lead.display_name ?? lead.instagram_username ?? phone,
    bio: lead.bio ?? "",
    city: lead.city ?? undefined,
    state: lead.state ?? undefined,
    country: "Brasil",
    discoveryKeyword: lead.discovery_keyword ?? undefined,
  };
}

function toLeadScore(lead: WhatsAppLeadRow): LeadScoreResult {
  return {
    rawLeadScore: lead.lead_score ?? 0,
    leadScore: lead.lead_score ?? 0,
    commercialValueScore: lead.commercial_value_score ?? 0,
    leadType: lead.lead_type === "business" || lead.lead_type === "professional" || lead.lead_type === "learner" ? lead.lead_type : "unknown",
    marketAwareness:
      lead.market_awareness === "competing_solution_user" ||
      lead.market_awareness === "professional_integrator" ||
      lead.market_awareness === "solution_aware" ||
      lead.market_awareness === "automation_aware" ||
      lead.market_awareness === "problem_aware"
        ? lead.market_awareness
        : "unaware",
    geographyTier: "tier_3",
    territoryOpportunityScore: 0,
    projectReadiness: "unknown",
    businessType: lead.lead_type ?? "unknown",
    estimatedRole: "unknown",
    scoreExplanation: [],
    commercialExplanation: [],
  };
}
