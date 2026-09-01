import type { AppMode } from "@/lib/types";

export const env = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL,
  openaiModelFast: process.env.OPENAI_MODEL_FAST,
  openaiMonthlyBudgetUsd: Number(process.env.OPENAI_MONTHLY_BUDGET_USD ?? 0),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  chromeCdpUrl: process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222",
  evolutionApiUrl: process.env.EVOLUTION_API_URL,
  evolutionApiKey: process.env.EVOLUTION_API_KEY,
  evolutionInstance: process.env.EVOLUTION_INSTANCE,
  appMode: (process.env.APP_MODE ?? "dry_run") as AppMode,
  masterPause: process.env.MASTER_PAUSE === "true",
};

export function integrationReady(...values: Array<string | undefined>): boolean {
  return values.every((value) => typeof value === "string" && value.trim().length > 0);
}
