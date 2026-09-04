import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import type { DashboardLead } from "@/features/analytics/dashboard-data";

export type LeadReviewFilters = {
  q?: string;
  minScore?: number;
  lane?: string;
};

export type LeadPipelineItem = {
  id: string;
  kind: "event" | "message" | "job";
  title: string;
  detail: string;
  status: string;
  createdAt: string | null;
};

export async function listLeadsForReview(filters: LeadReviewFilters): Promise<DashboardLead[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("leads")
    .select("id, instagram_username, display_name, bio, city, state, lead_type, market_awareness, lead_score, commercial_value_score, discovery_keyword, discovered_at, channel_state, do_not_contact, human_review_required")
    .order("discovered_at", { ascending: false })
    .limit(100);

  if (filters.minScore) {
    query = query.gte("lead_score", filters.minScore);
  }

  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(`instagram_username.ilike.${term},display_name.ilike.${term},bio.ilike.${term},discovery_keyword.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as DashboardLead[];
}

export async function listLeadPipeline(leadId: string): Promise<LeadPipelineItem[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const [events, messages, jobs] = await Promise.all([
    supabase
      .from("lead_events")
      .select("id, event_type, summary, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("messages")
      .select("id, direction, body, message_variant, result, sent_at, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("jobs")
      .select("id, type, status, payload, run_after, created_at, last_error")
      .contains("payload", { leadId })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const pipeline: LeadPipelineItem[] = [
    ...((events.data ?? []) as Array<{ id: string; event_type: string; summary: string | null; created_at: string | null }>).map((event) => ({
      id: event.id,
      kind: "event" as const,
      title: eventTitle(event.event_type),
      detail: event.summary ?? event.event_type,
      status: "registrado",
      createdAt: event.created_at,
    })),
    ...((messages.data ?? []) as Array<{ id: string; direction: string; body: string; message_variant: string | null; result: string | null; sent_at: string | null; created_at: string | null }>).map(
      (message) => ({
        id: message.id,
        kind: "message" as const,
        title: message.direction === "outbound" ? "Mensagem de abordagem" : "Resposta recebida",
        detail: message.body,
        status: message.result ?? (message.sent_at ? "enviada" : "preparada"),
        createdAt: message.created_at,
      }),
    ),
    ...((jobs.data ?? []) as Array<{ id: string; type: string; status: string; run_after: string | null; last_error: string | null; created_at: string | null }>).map((job) => ({
      id: job.id,
      kind: "job" as const,
      title: jobTitle(job.type),
      detail: job.last_error ?? (job.run_after ? `Agendado para ${formatDateTime(job.run_after)}` : job.type),
      status: job.status,
      createdAt: job.created_at,
    })),
  ];

  return pipeline.sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()).slice(0, 18);
}

export async function approveLeadForOutreach(formData: FormData) {
  "use server";

  const appMode = await getOperationalAppMode();
  const leadId = String(formData.get("leadId") ?? "");
  const lane = String(formData.get("lane") ?? "review");
  const username = String(formData.get("username") ?? "");
  const approvedMessage = String(formData.get("approvedMessage") ?? "").trim();
  const returnTo = getSafeReturnPath(formData);

  if (!leadId) {
    throw new Error("Lead ID is required");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      channel_state: "approved_for_outreach",
      human_review_required: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (leadError) {
    throw leadError;
  }

  const normalizedUsername = username.replace(/^@/, "");
  const conversationExternalId = `instagram:${normalizedUsername}`;
  const conversation = await supabase
    .from("conversations")
    .upsert(
      {
        lead_id: leadId,
        channel: "browser",
        external_conversation_id: conversationExternalId,
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

  const messageBody = approvedMessage || `Abordagem aprovada para ${username}.`;
  const messageResult = appMode === "dry_run" || appMode === "simulation" ? "dry_run_prepared_not_sent" : "queued_for_operator_confirmation";
  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversation.data.id,
    lead_id: leadId,
    channel: "browser",
    direction: "outbound",
    body: messageBody,
    message_variant: "first_contact_approved",
    result: messageResult,
  });

  if (messageError) {
    throw messageError;
  }

  const { error: eventError } = await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: "approved_for_outreach",
    summary: `Lead ${username} aprovado para abordagem em ${lane}`,
    payload: {
      lane,
      approvedBy: "operator",
      approvedMessage,
    },
  });

  if (eventError) {
    throw eventError;
  }

  const { error: preparedEventError } = await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: "outreach_message_prepared",
    summary:
      appMode === "dry_run" || appMode === "simulation"
        ? `Mensagem de abordagem preparada para ${username}; envio bloqueado pelo modo dry-run.`
        : `Mensagem de abordagem preparada para ${username}; aguardando confirmação operacional.`,
    payload: {
      lane,
      channel: "instagram",
      appMode,
    },
  });

  if (preparedEventError) {
    throw preparedEventError;
  }

  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 2);
  const { error: followUpError } = await supabase.from("jobs").upsert(
    {
      type: "schedule_followup",
      status: "queued",
      idempotency_key: `followup:${leadId}:first_contact`,
      max_attempts: 1,
      run_after: followUpDate.toISOString(),
      payload: {
        leadId,
        lane,
        channel: "instagram",
        reason: "Acompanhar resposta da primeira abordagem aprovada",
      },
    },
    { onConflict: "idempotency_key" },
  );

  if (followUpError) {
    throw followUpError;
  }

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(returnTo, "Abordagem aprovada, conversa criada e acompanhamento agendado no CRM.");
}

export async function updateLeadReviewState(formData: FormData) {
  "use server";

  const leadId = String(formData.get("leadId") ?? "");
  const username = String(formData.get("username") ?? "");
  const action = String(formData.get("action") ?? "");
  const lane = String(formData.get("lane") ?? "review");
  const returnTo = getSafeReturnPath(formData);

  if (!leadId) {
    throw new Error("Lead ID is required");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const stateByAction: Record<string, { channel_state: string; human_review_required: boolean; do_not_contact?: boolean }> = {
    approve: { channel_state: "approved_for_outreach", human_review_required: false },
    partnership: { channel_state: "partnership_review", human_review_required: true },
    nurture: { channel_state: "nurture_later", human_review_required: false },
    reject: { channel_state: "rejected", human_review_required: false },
    do_not_contact: { channel_state: "do_not_contact", human_review_required: false, do_not_contact: true },
  };

  const nextState = stateByAction[action];
  if (!nextState) {
    throw new Error("Invalid lead review action");
  }

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      ...nextState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (leadError) {
    throw leadError;
  }

  if (action === "do_not_contact") {
    await supabase.from("do_not_contact").upsert({
      lead_id: leadId,
      reason: "Marcado manualmente na revisão de leads",
    });
  }

  const { error: eventError } = await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: `review_${action}`,
    summary: `Lead ${username} marcado como ${action}`,
    payload: {
      lane,
      action,
      actor: "operator",
    },
  });

  if (eventError) {
    throw eventError;
  }

  revalidatePath("/");
  revalidatePath("/leads");
  redirectWithNotice(returnTo, actionNotice(action));
}

function getSafeReturnPath(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "/leads");

  return returnTo.startsWith("/leads") ? returnTo : "/leads";
}

function redirectWithNotice(returnTo: string, notice: string): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}notice=${encodeURIComponent(notice)}`);
}

function actionNotice(action: string) {
  const notices: Record<string, string> = {
    partnership: "Lead marcado para parceria/divulgação.",
    nurture: "Lead marcado para nutrir depois.",
    reject: "Lead descartado.",
    do_not_contact: "Lead bloqueado como não contatar.",
  };

  return notices[action] ?? "Decisão registrada no CRM.";
}

function eventTitle(eventType: string) {
  const labels: Record<string, string> = {
    approved_for_outreach: "Abordagem aprovada",
    outreach_message_prepared: "Mensagem preparada",
    discovered_on_instagram: "Lead descoberto",
    review_partnership: "Marcado como parceria",
    review_nurture: "Marcado para nutrir",
    review_reject: "Lead descartado",
    review_do_not_contact: "Bloqueado",
  };

  return labels[eventType] ?? eventType;
}

function jobTitle(type: string) {
  const labels: Record<string, string> = {
    schedule_followup: "Acompanhamento",
    send_instagram_dm: "Envio Instagram",
    discover_leads: "Prospecção",
  };

  return labels[type] ?? type;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
