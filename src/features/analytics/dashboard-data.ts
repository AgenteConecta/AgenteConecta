import { getSupabaseAdminClient } from "@/integrations/supabase/client";

export type DashboardLead = {
  id: string;
  instagram_username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  lead_type: string | null;
  market_awareness: string | null;
  lead_score: number | null;
  commercial_value_score: number | null;
  discovery_keyword: string | null;
  discovered_at: string | null;
};

export type DashboardData = {
  connected: boolean;
  metrics: {
    leadsDiscoveredToday: number;
    qualifiedLeads: number;
    dmsSent: number;
    responses: number;
    whatsappStarted: number;
    trainingSales: number;
    credentialingSales: number;
    credentialedPartners: number;
    activeResellers: number;
    attributedRevenue: number;
    openAiCost: number;
  };
  hotLead: DashboardLead | null;
  recentLeads: DashboardLead[];
};

const emptyMetrics = {
  leadsDiscoveredToday: 0,
  qualifiedLeads: 0,
  dmsSent: 0,
  responses: 0,
  whatsappStarted: 0,
  trainingSales: 0,
  credentialingSales: 0,
  credentialedPartners: 0,
  activeResellers: 0,
  attributedRevenue: 0,
  openAiCost: 0,
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      connected: false,
      metrics: emptyMetrics,
      hotLead: null,
      recentLeads: [],
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    leadsToday,
    qualified,
    dms,
    responses,
    whatsapp,
    trainingSales,
    credentialingSales,
    credentialed,
    activeResellers,
    revenue,
    aiCost,
    hotLead,
    recentLeads,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("discovered_at", today.toISOString()),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("lead_score", 50),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("channel", "browser").eq("direction", "outbound"),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("direction", "inbound"),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("channel", "whatsapp"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("credentialing").select("lead_id", { count: "exact", head: true }).not("credentialed_at", "is", null),
    supabase.from("credentialing").select("lead_id", { count: "exact", head: true }).not("active_reseller_at", "is", null),
    supabase.from("orders").select("amount_brl").eq("status", "paid"),
    supabase.from("ai_calls").select("estimated_cost"),
    supabase
      .from("leads")
      .select("id, instagram_username, display_name, bio, city, state, lead_type, market_awareness, lead_score, commercial_value_score, discovery_keyword, discovered_at")
      .order("commercial_value_score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id, instagram_username, display_name, bio, city, state, lead_type, market_awareness, lead_score, commercial_value_score, discovery_keyword, discovered_at")
      .order("discovered_at", { ascending: false })
      .limit(8),
  ]);

  const attributedRevenue = (revenue.data ?? []).reduce((sum, order) => sum + Number(order.amount_brl ?? 0), 0);
  const openAiCost = (aiCost.data ?? []).reduce((sum, call) => sum + Number(call.estimated_cost ?? 0), 0);

  return {
    connected: true,
    metrics: {
      leadsDiscoveredToday: leadsToday.count ?? 0,
      qualifiedLeads: qualified.count ?? 0,
      dmsSent: dms.count ?? 0,
      responses: responses.count ?? 0,
      whatsappStarted: whatsapp.count ?? 0,
      trainingSales: trainingSales.count ?? 0,
      credentialingSales: credentialingSales.count ?? 0,
      credentialedPartners: credentialed.count ?? 0,
      activeResellers: activeResellers.count ?? 0,
      attributedRevenue,
      openAiCost,
    },
    hotLead: (hotLead.data as DashboardLead | null) ?? null,
    recentLeads: (recentLeads.data as DashboardLead[] | null) ?? [],
  };
}
