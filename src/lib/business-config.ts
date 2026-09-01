import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { BusinessConfig } from "@/lib/types";

const businessConfigSchema = z.object({
  owner: z.object({
    name: z.string(),
    role: z.string(),
    company: z.string(),
  }),
  company: z.object({
    name: z.string(),
    website: z.string().url(),
    trainingWebsite: z.string().url(),
    country: z.string(),
  }),
  channels: z.object({
    instagram: z.object({
      handle: z.string(),
      url: z.string().url(),
    }),
    whatsapp: z.object({
      number: z.string(),
      provider: z.literal("evolution"),
    }),
  }),
  offers: z.object({
    basicTraining: z.object({
      name: z.string(),
      priceBRL: z.number(),
      credentialing: z.literal(false),
    }),
    credentialing: z.object({
      name: z.string(),
      priceBRL: z.number(),
      credentialing: z.literal(true),
      requirements: z.array(z.string()),
    }),
  }),
  priorityStates: z.array(z.string()),
  secondaryStates: z.array(z.string()),
  primarySegments: z.array(z.string()),
  centralizedAutomationKeywords: z.array(z.string()),
  complementarySegments: z.array(z.string()),
  territoryOpportunityDefaults: z.object({
    tier_1: z.number(),
    tier_2: z.number(),
    tier_3: z.number(),
  }),
  safetyLimits: z.object({
    MAX_DMS_PER_DAY: z.number(),
    MIN_SECONDS_BETWEEN_DMS: z.number(),
    MAX_SECONDS_BETWEEN_DMS: z.number(),
    OPERATING_HOURS: z.string(),
    OPERATING_TIMEZONE: z.string(),
    WARMUP_ENABLED: z.boolean(),
    MAX_FOLLOWUPS: z.number(),
  }),
  kit: z.object({
    name: z.string(),
    priceBRL: z.number().nullable(),
    composition: z.array(z.string()),
  }),
});

let cachedConfig: BusinessConfig | null = null;

export function loadBusinessConfig(): BusinessConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const path = join(process.cwd(), "config", "business.json");
  const parsed = businessConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  cachedConfig = parsed;
  return parsed;
}

export function formatBRL(value: number | null): string {
  if (value === null) {
    return "a definir";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
