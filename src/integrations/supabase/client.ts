import { createClient } from "@supabase/supabase-js";
import { env, integrationReady, normalizeSupabaseUrl } from "@/lib/env";

export function getSupabaseAdminClient() {
  if (!integrationReady(env.supabaseUrl, env.supabaseServiceRoleKey)) {
    return null;
  }

  return createClient(normalizeSupabaseUrl(env.supabaseUrl as string), env.supabaseServiceRoleKey as string, {
    auth: {
      persistSession: false,
    },
  });
}
