import { findDuplicateLead } from "@/features/leads/dedupe";
import { scoreLead } from "@/features/scoring/scoring";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import type { LeadProfileInput } from "@/lib/types";

export type PersistLeadResult = {
  mode: "dry_run" | "persisted";
  duplicateLeadId: string | null;
  leadId: string | null;
  score: ReturnType<typeof scoreLead>;
};

export async function persistDiscoveredLead(input: LeadProfileInput): Promise<PersistLeadResult> {
  const score = scoreLead(input);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      mode: "dry_run",
      duplicateLeadId: null,
      leadId: null,
      score,
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("leads")
    .select("id, instagram_username, instagram_id, phone, email, website, company_name");

  if (existingError) {
    throw existingError;
  }

  const duplicate = findDuplicateLead(
    {
      instagramUsername: input.instagramUsername,
      website: input.website,
    },
    (existing ?? []).map((lead) => ({
      id: lead.id as string,
      instagramUsername: lead.instagram_username as string | null,
      instagramId: lead.instagram_id as string | null,
      phone: lead.phone as string | null,
      email: lead.email as string | null,
      website: lead.website as string | null,
      companyName: lead.company_name as string | null,
    })),
  );

  if (duplicate) {
    return {
      mode: "persisted",
      duplicateLeadId: duplicate.id,
      leadId: duplicate.id,
      score,
    };
  }

  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert({
      instagram_username: input.instagramUsername.replace(/^@/, ""),
      display_name: input.displayName,
      bio: input.bio,
      category: input.category,
      city: input.city,
      state: input.state,
      country: input.country ?? "Brasil",
      website: input.website,
      business_type: score.businessType,
      estimated_role: score.estimatedRole,
      market_awareness: score.marketAwareness,
      lead_type: score.leadType,
      lead_score: score.leadScore,
      commercial_value_score: score.commercialValueScore,
      geography_tier: score.geographyTier,
      territory_opportunity_score: score.territoryOpportunityScore,
      project_readiness: score.projectReadiness,
      discovery_source: input.discoverySource,
      discovery_keyword: input.discoveryKeyword,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  const leadId = lead.id as string;

  await supabase.from("lead_scores").insert({
    lead_id: leadId,
    raw_lead_score: score.rawLeadScore,
    lead_score: score.leadScore,
    commercial_value_score: score.commercialValueScore,
    explanation: score.scoreExplanation,
    commercial_explanation: score.commercialExplanation,
  });

  await supabase.from("lead_profiles").insert({
    lead_id: leadId,
    public_snapshot: {
      followers: input.followers ?? null,
      category: input.category ?? null,
      website: input.website ?? null,
      discoverySource: input.discoverySource ?? null,
      discoveryKeyword: input.discoveryKeyword ?? null,
    },
    posts: input.posts ?? [],
    analyzed_at: new Date().toISOString(),
  });

  await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: "discovered_on_instagram",
    summary: `Lead descoberto por ${input.discoverySource ?? "simulação"}`,
    payload: {
      discoveryKeyword: input.discoveryKeyword,
      score,
    },
  });

  return {
    mode: "persisted",
    duplicateLeadId: null,
    leadId,
    score,
  };
}
