import { NextResponse } from "next/server";
import { env, integrationReady, normalizeSupabaseUrl } from "@/lib/env";
import { getEvolutionStatus } from "@/integrations/evolution/evolution-client";
import { getOperationalAppMode } from "@/features/safety/app-mode";

export async function GET() {
  const appMode = await getOperationalAppMode();
  const evolutionStatus = await getEvolutionStatus();

  return NextResponse.json({
    ok: true,
    mode: appMode,
    masterPause: env.masterPause,
    integrations: {
      openai: integrationReady(env.openaiApiKey, env.openaiModel, env.openaiModelFast),
      supabase: integrationReady(env.supabaseUrl, env.supabaseServiceRoleKey),
      supabaseUrlNormalized: env.supabaseUrl ? normalizeSupabaseUrl(env.supabaseUrl) : null,
      evolution: evolutionStatus.configured,
      instagramBrowser: Boolean(env.chromeCdpUrl),
    },
  });
}
