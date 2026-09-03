"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { sendInitialInstagramDm } from "@/integrations/instagram/browser-worker";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { isOperationallyPaused } from "@/features/safety/operation-pause";
import type { LeadProfileInput, LeadScoreResult } from "@/lib/types";

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

type QualifiedLeadRow = {
  id: string;
  instagram_username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  discovery_keyword: string | null;
  lead_score: number | null;
  commercial_value_score: number | null;
  lead_type: string | null;
  market_awareness: string | null;
  do_not_contact: boolean | null;
  channel_state: string | null;
};

type LeadProfileRow = {
  lead_id: string;
  public_snapshot: {
    followers?: number | string | null;
  } | null;
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

export async function getAutomaticOutreachCandidateCount() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return 0;
  }

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("lead_score", 70)
    .eq("do_not_contact", false)
    .not("channel_state", "in", '("outreach_prepared","operator_confirmation_required","approved_for_outreach","do_not_contact","rejected")');

  return count ?? 0;
}

export async function processApprovedOutreach(formData: FormData) {
  const maxMessagesRaw = Number(formData.get("maxMessages") ?? 5);
  const maxMessages = normalizeBatchSize(maxMessagesRaw);

  if (await isOperationallyPaused()) {
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
    if (await isOperationallyPaused()) {
      break;
    }

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

export async function processAutomaticQualifiedOutreach(formData: FormData) {
  const minScoreRaw = Number(formData.get("minScore") ?? 70);
  const minFollowersRaw = Number(formData.get("minFollowers") ?? 10000);
  const maxMessagesRaw = Number(formData.get("batchSize") ?? formData.get("maxMessages") ?? 5);
  const minScore = Math.max(0, Math.min(Number.isFinite(minScoreRaw) ? minScoreRaw : 70, 100));
  const minFollowers = Math.max(0, Math.min(Number.isFinite(minFollowersRaw) ? minFollowersRaw : 10000, 10_000_000));
  const maxMessages = normalizeBatchSize(maxMessagesRaw);

  if (await isOperationallyPaused()) {
    redirectWithNotice("Pausa geral ativa. Nenhum contato automático foi processado.");
  }

  const result = await runAutomaticQualifiedOutreach({
    minScore,
    minFollowers,
    maxMessages,
  });

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(
    `Contato automático: ${result.prepared} mensagens criadas, ${result.processed} processadas, ${result.failed} falhas. Critério: score ${minScore}+ ou ${minFollowers}+ seguidores.`,
  );
}

export async function runAutomaticQualifiedOutreach({
  minScore,
  minFollowers,
  maxMessages,
}: {
  minScore: number;
  minFollowers: number;
  maxMessages: number;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      prepared: 0,
      processed: 0,
      failed: 1,
    };
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, instagram_username, display_name, bio, city, state, discovery_keyword, lead_score, commercial_value_score, lead_type, market_awareness, do_not_contact, channel_state")
    .eq("do_not_contact", false)
    .not("instagram_username", "is", null)
    .not("channel_state", "in", '("outreach_prepared","operator_confirmation_required","approved_for_outreach","do_not_contact","rejected")')
    .order("lead_score", { ascending: false })
    .limit(200);

  if (error) {
    return {
      prepared: 0,
      processed: 0,
      failed: 1,
    };
  }

  const rows = (leads ?? []) as QualifiedLeadRow[];
  const ids = rows.map((lead) => lead.id);
  const { data: profiles } = ids.length > 0
    ? await supabase.from("lead_profiles").select("lead_id, public_snapshot").in("lead_id", ids)
    : { data: [] };
  const followersByLeadId = new Map(
    ((profiles ?? []) as LeadProfileRow[]).map((profile) => [profile.lead_id, Number(profile.public_snapshot?.followers ?? 0)]),
  );
  const candidates = rows
    .map((lead) => ({
      lead,
      followers: followersByLeadId.get(lead.id) ?? 0,
    }))
    .filter(({ lead, followers }) => Number(lead.lead_score ?? 0) >= minScore || followers >= minFollowers)
    .slice(0, maxMessages);

  let prepared = 0;
  let processed = 0;
  let failed = 0;

  for (const candidate of candidates) {
    if (await isOperationallyPaused()) {
      break;
    }

    try {
      const messageId = await createAutomaticOutreachMessage(candidate.lead, candidate.followers, minScore, minFollowers);
      prepared += 1;
      const outcome = await processMessageById(messageId);

      if (outcome === "failed") {
        failed += 1;
      } else {
        processed += 1;
      }
    } catch (error) {
      failed += 1;
      await supabase.from("lead_events").insert({
        lead_id: candidate.lead.id,
        event_type: "automatic_outreach_failed",
        summary: error instanceof Error ? error.message : "Erro desconhecido no contato automático.",
        payload: {
          minScore,
          minFollowers,
          appMode: env.appMode,
        },
      });
    }
  }

  return {
    prepared,
    processed,
    failed,
  };
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

async function createAutomaticOutreachMessage(lead: QualifiedLeadRow, followers: number, minScore: number, minFollowers: number) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const username = lead.instagram_username ?? "";
  const conversation = await supabase
    .from("conversations")
    .upsert(
      {
        lead_id: lead.id,
        channel: "browser",
        external_conversation_id: `instagram:${username.replace(/^@/, "")}`,
        status: "open",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel,external_conversation_id" },
    )
    .select("id")
    .single();

  if (conversation.error) {
    throw conversation.error;
  }

  const message = generateFirstContactMessage(toLeadInput(lead, followers), toLeadScore(lead));
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.data.id,
      lead_id: lead.id,
      channel: "browser",
      direction: "outbound",
      body: message,
      message_variant: "first_contact_auto_qualified",
      result: env.appMode === "dry_run" || env.appMode === "simulation" ? "dry_run_prepared_not_sent" : "queued_for_operator_confirmation",
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await supabase
    .from("leads")
    .update({
      channel_state: "auto_outreach_qualified",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  await supabase.from("lead_events").insert({
    lead_id: lead.id,
    event_type: "automatic_outreach_qualified",
    summary: `Lead @${username} selecionado automaticamente por score/seguidores.`,
    payload: {
      messageId: data.id,
      leadScore: lead.lead_score,
      followers,
      minScore,
      minFollowers,
      appMode: env.appMode,
    },
  });

  return data.id as string;
}

async function processMessageById(messageId: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return "failed";
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, lead_id, body, result, leads(instagram_username, do_not_contact)")
    .eq("id", messageId)
    .single();

  if (error || !data) {
    return "failed";
  }

  const message = data as PendingOutreachMessage;
  const lead = Array.isArray(message.leads) ? message.leads[0] : message.leads;
  const username = lead?.instagram_username;

  if (!username || lead?.do_not_contact) {
    await markMessageResult(message.id, message.lead_id, "blocked_do_not_contact", "Contato automático bloqueado por ausência de username ou do-not-contact.");
    return "blocked";
  }

  try {
    const result = await sendInitialInstagramDm({
      profileUrl: `https://www.instagram.com/${username.replace(/^@/, "")}/`,
      message: message.body,
      idempotencyKey: `instagram-auto-first-contact:${message.id}`,
    });
    await supabase
      .from("messages")
      .update({
        result: result.result,
        page_url: result.pageUrl,
        sent_at: result.sentAt ? new Date(result.sentAt).toISOString() : null,
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
      event_type: "automatic_outreach_processed",
      summary:
        result.result === "dry_run_blocked"
          ? `Contato automático de @${username} validado, mas não enviado por dry-run.`
          : `Contato automático de @${username} preparado para confirmação operacional.`,
      payload: {
        messageId: message.id,
        result: result.result,
        pageUrl: result.pageUrl,
        appMode: env.appMode,
      },
    });

    return "processed";
  } catch (error) {
    await markMessageResult(
      message.id,
      message.lead_id,
      "send_failed",
      error instanceof Error ? error.message : "Erro desconhecido ao processar contato automático.",
    );
    return "failed";
  }
}

function toLeadInput(lead: QualifiedLeadRow, followers: number): LeadProfileInput {
  return {
    instagramUsername: `@${lead.instagram_username ?? ""}`,
    displayName: lead.display_name ?? lead.instagram_username ?? "Lead",
    bio: lead.bio ?? "",
    city: lead.city ?? undefined,
    state: lead.state ?? undefined,
    country: "Brasil",
    followers,
    discoveryKeyword: lead.discovery_keyword ?? undefined,
  };
}

function toLeadScore(lead: QualifiedLeadRow): LeadScoreResult {
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

function normalizeBatchSize(value: number) {
  if (value >= 15) {
    return 15;
  }
  if (value >= 10) {
    return 10;
  }

  return 5;
}

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
