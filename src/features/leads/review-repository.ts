import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import type { DashboardLead } from "@/features/analytics/dashboard-data";

export type LeadReviewFilters = {
  q?: string;
  minScore?: number;
  lane?: string;
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

export async function approveLeadForOutreach(formData: FormData) {
  "use server";

  const leadId = String(formData.get("leadId") ?? "");
  const lane = String(formData.get("lane") ?? "review");
  const username = String(formData.get("username") ?? "");

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

  const { error: eventError } = await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: "approved_for_outreach",
    summary: `Lead ${username} aprovado para abordagem em ${lane}`,
    payload: {
      lane,
      approvedBy: "operator",
    },
  });

  if (eventError) {
    throw eventError;
  }

  revalidatePath("/");
  revalidatePath("/leads");
}

export async function updateLeadReviewState(formData: FormData) {
  "use server";

  const leadId = String(formData.get("leadId") ?? "");
  const username = String(formData.get("username") ?? "");
  const action = String(formData.get("action") ?? "");
  const lane = String(formData.get("lane") ?? "review");

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
}
