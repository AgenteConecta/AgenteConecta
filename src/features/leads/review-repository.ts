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
    .select("id, instagram_username, display_name, bio, city, state, lead_type, market_awareness, lead_score, commercial_value_score, discovery_keyword, discovered_at")
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
