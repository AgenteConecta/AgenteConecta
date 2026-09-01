import { createClient } from "@supabase/supabase-js";
import { env, integrationReady } from "@/lib/env";

export function getSupabaseAdminClient() {
  if (!integrationReady(env.supabaseUrl, env.supabaseServiceRoleKey)) {
    return null;
  }

  return createClient(env.supabaseUrl as string, env.supabaseServiceRoleKey as string, {
    auth: {
      persistSession: false,
    },
  });
}
