import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { getProspectingAudience, parseCustomKeywords } from "@/features/prospecting/audiences";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { persistDiscoveredLead } from "@/features/leads/lead-repository";
import { hasMinimumIcpSignal } from "@/features/prospecting/icp-filter";
import { discoverProfilesFromHashtag, readInstagramPublicProfile } from "@/integrations/instagram/browser-worker";

export async function queueProspectingRun(formData: FormData) {
  "use server";

  const audience = getProspectingAudience(String(formData.get("audience") ?? "auto"));
  const customKeywords = parseCustomKeywords(String(formData.get("keywords") ?? ""));
  const maxProfilesRaw = Number(formData.get("maxProfiles") ?? 5);
  const maxProfilesPerKeyword = Math.max(1, Math.min(Number.isFinite(maxProfilesRaw) ? maxProfilesRaw : 5, 10));
  const keywords = (customKeywords.length > 0 ? customKeywords : audience.keywords).slice(0, 5);
  const runNow = formData.get("runNow") === "on";

  if (env.masterPause) {
    redirectWithNotice("Master pause ativo. Desative a pausa antes de iniciar uma nova prospecção.");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirectWithNotice("Supabase não está configurado. A prospecção não foi enfileirada.");
  }

  const idempotencyKey = `discover:${audience.id}:${keywords.join("|").toLowerCase()}:${maxProfilesPerKeyword}:${new Date().toISOString().slice(0, 13)}`;
  const { data: job, error } = await supabase.from("jobs").upsert(
    {
      type: "discover_leads",
      status: "queued",
      idempotency_key: idempotencyKey,
      max_attempts: 1,
      payload: {
        audienceId: audience.id,
        audienceLabel: audience.label,
        keywords,
        maxProfilesPerKeyword,
        source: "dashboard",
        dryRun: env.appMode === "dry_run",
      },
    },
    { onConflict: "idempotency_key" },
  ).select("id").single();

  if (error) {
    redirectWithNotice(`Erro ao enfileirar prospecção: ${error.message}`);
  }

  if (runNow) {
    const summary = await runProspectingKeywords(keywords, maxProfilesPerKeyword);
    await supabase
      .from("jobs")
      .update({
        status: summary.errors > 0 && summary.persisted === 0 ? "dead" : "completed",
        last_error: summary.errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    revalidatePath("/");
    revalidatePath("/leads");
    redirectWithNotice(
      `Prospecção concluída: ${summary.persisted} novos, ${summary.duplicates} duplicados, ${summary.filteredOut} filtrados, ${summary.errors} erros.`,
    );
  }

  revalidatePath("/");
  redirectWithNotice(`Prospecção enfileirada: ${audience.label} com ${keywords.length} buscas. Modo dry-run: nenhum contato será enviado.`);
}

async function runProspectingKeywords(keywords: string[], maxProfilesPerKeyword: number) {
  const summary = {
    persisted: 0,
    duplicates: 0,
    filteredOut: 0,
    errors: 0,
    errorMessage: null as string | null,
  };

  for (const keyword of keywords) {
    const discovered = await discoverProfilesFromHashtag({ keyword, maxProfiles: maxProfilesPerKeyword }).catch((error: unknown) => {
      summary.errors += 1;
      summary.errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao pesquisar no Instagram.";
      return [];
    });

    for (const lead of discovered) {
      const enrichedLead = await readInstagramPublicProfile(lead.instagramUsername).then((profile) => ({
        ...lead,
        ...profile,
        discoverySource: lead.discoverySource,
        discoveryKeyword: lead.discoveryKeyword,
      }));

      if (!hasMinimumIcpSignal(enrichedLead)) {
        summary.filteredOut += 1;
        continue;
      }

      const persistence = await persistDiscoveredLead(enrichedLead);
      generateFirstContactMessage(enrichedLead, persistence.score);

      if (persistence.duplicateLeadId) {
        summary.duplicates += 1;
      } else if (persistence.mode === "persisted") {
        summary.persisted += 1;
      }
    }
  }

  return summary;
}

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
