import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { normalizeEvolutionInboundText } from "@/integrations/evolution/webhook";

async function main() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, body")
    .eq("channel", "whatsapp")
    .ilike("body", "%\\%%")
    .limit(500);

  if (error) {
    throw error;
  }

  const messages = data ?? [];
  let updated = 0;

  for (const message of messages) {
    const normalized = normalizeEvolutionInboundText(String(message.body ?? ""));

    if (normalized && normalized !== message.body) {
      const { error: updateError } = await supabase.from("messages").update({ body: normalized }).eq("id", message.id);

      if (updateError) {
        throw updateError;
      }

      updated += 1;
    }
  }

  console.log(JSON.stringify({ scanned: messages.length, updated }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
