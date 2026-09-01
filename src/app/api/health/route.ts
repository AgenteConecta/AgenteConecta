import { NextResponse } from "next/server";
import { env, integrationReady, normalizeSupabaseUrl } from "@/lib/env";
import { getEvolutionStatus } from "@/integrations/evolution/evolution-client";

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: env.appMode,
    masterPause: env.masterPause,
    integrations: {
      openai: integrationReady(env.openaiApiKey, env.openaiModel, env.openaiModelFast),
      supabase: integrationReady(env.supabaseUrl, env.supabaseServiceRoleKey),
      supabaseUrlNormalized: env.supabaseUrl ? normalizeSupabaseUrl(env.supabaseUrl) : null,
      evolution: getEvolutionStatus().configured,
      instagramBrowser: Boolean(env.chromeCdpUrl),
    },
  });
}
