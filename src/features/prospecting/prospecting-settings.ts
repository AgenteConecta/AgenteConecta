import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";

export type ProspectingDefaults = {
  audienceId: string;
  audienceLabel: string;
  keywords: string[];
  targetNewLeads: number;
  maxProfilesPerKeyword: number;
  stopAtTarget: boolean;
  autoContact: boolean;
  minScore: number;
  minFollowers: number;
  batchSize: number;
};

const runtimeSettingsPath = path.join(process.cwd(), ".runtime-settings.json");
const settingsKey = "prospecting_defaults";

const defaultProspectingDefaults: ProspectingDefaults = {
  audienceId: "auto",
  audienceLabel: "Automático recomendado",
  keywords: ["automação residencial", "casa inteligente", "automação cabeada", "arquitetura residencial", "elétrica residencial"],
  targetNewLeads: 50,
  maxProfilesPerKeyword: 15,
  stopAtTarget: true,
  autoContact: true,
  minScore: 70,
  minFollowers: 10000,
  batchSize: 5,
};

export async function getProspectingDefaults(): Promise<ProspectingDefaults> {
  const localDefaults = await readLocalProspectingDefaults();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return localDefaults;
  }

  const { data, error } = await supabase.from("settings").select("value").eq("key", settingsKey).maybeSingle();

  if (error) {
    return localDefaults;
  }

  return normalizeProspectingDefaults({
    ...localDefaults,
    ...((data?.value as Partial<ProspectingDefaults> | null | undefined) ?? {}),
  });
}

export async function saveProspectingDefaults(defaults: ProspectingDefaults) {
  const next = normalizeProspectingDefaults(defaults);
  await writeLocalProspectingDefaults(next);

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await supabase.from("settings").upsert({
      key: settingsKey,
      value: {
        ...next,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    });
  }
}

async function readLocalProspectingDefaults(): Promise<ProspectingDefaults> {
  try {
    const raw = await readFile(runtimeSettingsPath, "utf8");
    const settings = JSON.parse(raw) as { prospectingDefaults?: Partial<ProspectingDefaults> };
    return normalizeProspectingDefaults(settings.prospectingDefaults ?? {});
  } catch {
    return defaultProspectingDefaults;
  }
}

async function writeLocalProspectingDefaults(prospectingDefaults: ProspectingDefaults) {
  let settings: Record<string, unknown> = {};

  try {
    settings = JSON.parse(await readFile(runtimeSettingsPath, "utf8")) as Record<string, unknown>;
  } catch {
    settings = {};
  }

  await writeFile(
    runtimeSettingsPath,
    `${JSON.stringify(
      {
        ...settings,
        prospectingDefaults,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function normalizeProspectingDefaults(value: Partial<ProspectingDefaults>): ProspectingDefaults {
  return {
    audienceId: typeof value.audienceId === "string" && value.audienceId ? value.audienceId : defaultProspectingDefaults.audienceId,
    audienceLabel: typeof value.audienceLabel === "string" && value.audienceLabel ? value.audienceLabel : defaultProspectingDefaults.audienceLabel,
    keywords: Array.isArray(value.keywords) && value.keywords.length > 0 ? value.keywords.map(String).filter(Boolean).slice(0, 12) : defaultProspectingDefaults.keywords,
    targetNewLeads: clampNumber(value.targetNewLeads, 1, 300, defaultProspectingDefaults.targetNewLeads),
    maxProfilesPerKeyword: clampNumber(value.maxProfilesPerKeyword, 1, 50, defaultProspectingDefaults.maxProfilesPerKeyword),
    stopAtTarget: typeof value.stopAtTarget === "boolean" ? value.stopAtTarget : defaultProspectingDefaults.stopAtTarget,
    autoContact: typeof value.autoContact === "boolean" ? value.autoContact : defaultProspectingDefaults.autoContact,
    minScore: clampNumber(value.minScore, 0, 100, defaultProspectingDefaults.minScore),
    minFollowers: clampNumber(value.minFollowers, 0, 10_000_000, defaultProspectingDefaults.minFollowers),
    batchSize: normalizeBatchSize(value.batchSize),
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(numeric, max));
}

function normalizeBatchSize(value: unknown) {
  const numeric = Number(value);
  if (numeric >= 15) {
    return 15;
  }
  if (numeric >= 10) {
    return 10;
  }

  return 5;
}
