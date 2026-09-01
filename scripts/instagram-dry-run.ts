async function loadLocalEnv() {
  const mod = await import("@next/env");
  const loader = mod.loadEnvConfig ?? mod.default?.loadEnvConfig;
  loader(process.cwd());
}

async function main() {
  await loadLocalEnv();
  const { loadBusinessConfig } = await import("@/lib/business-config");
  const { generateFirstContactMessage } = await import("@/features/conversations/first-contact");
  const { persistDiscoveredLead } = await import("@/features/leads/lead-repository");
  const { hasMinimumIcpSignal } = await import("@/features/prospecting/icp-filter");
  const { discoverProfilesFromHashtag, readInstagramPublicProfile } = await import("@/integrations/instagram/browser-worker");

  const config = loadBusinessConfig();
  const keywords = config.centralizedAutomationKeywords.slice(0, 3);
  const maxProfilesPerKeyword = Number(process.env.INSTAGRAM_DRY_RUN_MAX_PER_KEYWORD ?? 5);

  const results = [];

  for (const keyword of keywords) {
    const leads = await discoverProfilesFromHashtag({
      keyword,
      maxProfiles: maxProfilesPerKeyword,
    }).catch((error: unknown) => {
      results.push({
        username: null,
        keyword,
        mode: "error",
        leadId: null,
        duplicateLeadId: null,
        leadScore: 0,
        commercialValueScore: 0,
        firstContactMessage: null,
        error: error instanceof Error ? error.message : "Unknown Instagram discovery error",
      });
      return [];
    });

    for (const lead of leads) {
      const enrichedLead = await readInstagramPublicProfile(lead.instagramUsername).then((profile) => ({
        ...lead,
        ...profile,
        discoverySource: lead.discoverySource,
        discoveryKeyword: lead.discoveryKeyword,
      }));

      if (!hasMinimumIcpSignal(enrichedLead)) {
        results.push({
          username: enrichedLead.instagramUsername,
          keyword,
          mode: "filtered_out",
          leadId: null,
          duplicateLeadId: null,
          leadScore: 0,
          commercialValueScore: 0,
          firstContactMessage: null,
        });
        continue;
      }

      const persistence = await persistDiscoveredLead(enrichedLead);
      results.push({
        username: enrichedLead.instagramUsername,
        keyword,
        mode: persistence.mode,
        leadId: persistence.leadId,
        duplicateLeadId: persistence.duplicateLeadId,
        leadScore: persistence.score.leadScore,
        commercialValueScore: persistence.score.commercialValueScore,
        firstContactMessage: generateFirstContactMessage(enrichedLead, persistence.score),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        sentMessages: 0,
        keywords,
        discovered: results.length,
        persisted: results.filter((result) => result.mode === "persisted" && !result.duplicateLeadId).length,
        duplicates: results.filter((result) => result.duplicateLeadId).length,
        filteredOut: results.filter((result) => result.mode === "filtered_out").length,
        errors: results.filter((result) => result.mode === "error").length,
        results,
      },
      null,
      2,
    ),
  );
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export {};
