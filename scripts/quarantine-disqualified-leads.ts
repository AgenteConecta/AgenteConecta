import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { hasDisqualifyingIcpSignal } from "@/features/prospecting/icp-filter";

async function main() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("leads")
    .select("id, instagram_username, display_name, bio, category, city, state, website, discovery_keyword")
    .or("do_not_contact.is.null,do_not_contact.eq.false")
    .limit(1000);

  if (error) {
    throw error;
  }

  const leads = data ?? [];
  const blocked = leads.filter((lead) =>
    hasDisqualifyingIcpSignal({
      instagramUsername: `@${lead.instagram_username ?? ""}`,
      displayName: lead.display_name ?? undefined,
      bio: lead.bio ?? undefined,
      category: lead.category ?? undefined,
      city: lead.city ?? undefined,
      state: lead.state ?? undefined,
      website: lead.website ?? undefined,
      discoveryKeyword: lead.discovery_keyword ?? undefined,
    }),
  );

  for (const lead of blocked) {
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        channel_state: "do_not_contact",
        do_not_contact: true,
        human_review_required: false,
        updated_at: now,
      })
      .eq("id", lead.id);

    if (updateError) {
      throw updateError;
    }

    await supabase.from("do_not_contact").upsert({
      instagram_username: lead.instagram_username,
      reason: "Perfil bloqueado automaticamente por sinal adulto/escort ou fora do ICP.",
      source: "icp_cleanup",
      created_at: now,
    });

    await supabase.from("lead_events").insert({
      lead_id: lead.id,
      event_type: "auto_disqualified",
      summary: "Lead bloqueado automaticamente por sinal adulto/escort ou fora do ICP.",
      payload: {
        source: "icp_cleanup",
      },
    });
  }

  console.log(JSON.stringify({ scanned: leads.length, blocked: blocked.length }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
