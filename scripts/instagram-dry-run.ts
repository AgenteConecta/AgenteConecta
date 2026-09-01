import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { loadBusinessConfig } = await import("@/lib/business-config");
const { generateFirstContactMessage } = await import("@/features/conversations/first-contact");
const { persistDiscoveredLead } = await import("@/features/leads/lead-repository");
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
      results,
    },
    null,
    2,
  ),
);
process.exit(0);
