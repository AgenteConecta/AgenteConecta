import { NextResponse } from "next/server";
import { env, integrationReady } from "@/lib/env";

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: env.appMode,
    masterPause: env.masterPause,
    integrations: {
      openai: integrationReady(env.openaiApiKey, env.openaiModel, env.openaiModelFast),
      supabase: integrationReady(env.supabaseUrl, env.supabaseServiceRoleKey),
      evolution: integrationReady(env.evolutionApiUrl, env.evolutionApiKey, env.evolutionInstance),
      instagramBrowser: Boolean(env.chromeCdpUrl),
    },
  });
}
