"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { getProspectingAudience, parseCustomKeywords } from "@/features/prospecting/audiences";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { persistDiscoveredLead } from "@/features/leads/lead-repository";
import { hasMinimumIcpSignal } from "@/features/prospecting/icp-filter";
import { discoverProfilesFromHashtag, readInstagramPublicProfile } from "@/integrations/instagram/browser-worker";
import { runAutomaticQualifiedOutreach } from "@/features/outreach/outreach-actions";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import { isOperationallyPaused } from "@/features/safety/operation-pause";

export async function queueProspectingRun(formData: FormData) {
  const audience = getProspectingAudience(String(formData.get("audience") ?? "auto"));
  const audienceId = String(formData.get("audience") ?? audience.id);
  const audienceLabel = String(formData.get("audienceLabel") ?? audience.label).trim() || audience.label;
  const customKeywords = parseCustomKeywords(String(formData.get("keywords") ?? ""));
  const maxProfilesRaw = Number(formData.get("maxProfiles") ?? 5);
  const maxProfilesPerKeyword = Math.max(1, Math.min(Number.isFinite(maxProfilesRaw) ? maxProfilesRaw : 5, 10));
  const keywords = (customKeywords.length > 0 ? customKeywords : audience.keywords).slice(0, 5);
  const runNow = formData.get("runNow") === "on";
  const autoContact = formData.get("autoContact") === "on";
  const minScoreRaw = Number(formData.get("minScore") ?? 70);
  const minFollowersRaw = Number(formData.get("minFollowers") ?? 10000);
  const batchSizeRaw = Number(formData.get("batchSize") ?? 5);
  const minScore = Math.max(0, Math.min(Number.isFinite(minScoreRaw) ? minScoreRaw : 70, 100));
  const minFollowers = Math.max(0, Math.min(Number.isFinite(minFollowersRaw) ? minFollowersRaw : 10000, 10_000_000));
  const batchSize = normalizeBatchSize(batchSizeRaw);
  const appMode = await getOperationalAppMode();

  if (await isOperationallyPaused()) {
    redirectWithNotice("Master pause ativo. Desative a pausa antes de iniciar uma nova prospecção.");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirectWithNotice("Supabase não está configurado. A prospecção não foi enfileirada.");
  }

  const idempotencyKey = `discover:${audienceId}:${keywords.join("|").toLowerCase()}:${maxProfilesPerKeyword}:${new Date().toISOString().slice(0, 13)}`;
  const { data: job, error } = await supabase.from("jobs").upsert(
    {
      type: "discover_leads",
      status: "queued",
      idempotency_key: idempotencyKey,
      max_attempts: 1,
      payload: {
        audienceId,
        audienceLabel,
        keywords,
        maxProfilesPerKeyword,
        autoContact,
        minScore,
        minFollowers,
        batchSize,
        source: "dashboard",
        dryRun: appMode === "dry_run",
      },
    },
    { onConflict: "idempotency_key" },
  ).select("id").single();

  if (error) {
    redirectWithNotice(`Erro ao enfileirar prospecção: ${error.message}`);
  }

  if (runNow) {
    const summary = await runProspectingKeywords(keywords, maxProfilesPerKeyword);
    const outreachSummary = autoContact
      ? await runAutomaticQualifiedOutreach({
          minScore,
          minFollowers,
          maxMessages: batchSize,
        })
      : { prepared: 0, processed: 0, failed: 0 };

    await supabase
      .from("jobs")
      .update({
        status: summary.paused ? "cancelled" : summary.errors > 0 && summary.persisted === 0 ? "dead" : "completed",
        last_error: summary.paused ? "Suspenso pela pausa operacional" : summary.errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    revalidatePath("/");
    revalidatePath("/leads");
    redirectWithNotice(
      `Prospecção concluída: ${summary.persisted} novos, ${summary.duplicates} duplicados, ${summary.filteredOut} filtrados, ${summary.errors} erros. Contato automático: ${outreachSummary.prepared} criados, ${outreachSummary.processed} processados.`,
    );
  }

  revalidatePath("/");
  redirectWithNotice(`Prospecção enfileirada: ${audienceLabel} com ${keywords.length} buscas. Modo dry-run: nenhum contato será enviado.`);
}

async function runProspectingKeywords(keywords: string[], maxProfilesPerKeyword: number) {
  const summary = {
    persisted: 0,
    duplicates: 0,
    filteredOut: 0,
    errors: 0,
    paused: false,
    errorMessage: null as string | null,
  };

  for (const keyword of keywords) {
    if (await isOperationallyPaused()) {
      summary.paused = true;
      break;
    }

    const discovered = await discoverProfilesFromHashtag({ keyword, maxProfiles: maxProfilesPerKeyword }).catch((error: unknown) => {
      summary.errors += 1;
      summary.errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao pesquisar no Instagram.";
      return [];
    });

    for (const lead of discovered) {
      if (await isOperationallyPaused()) {
        summary.paused = true;
        break;
      }

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

function normalizeBatchSize(value: number) {
  if (value >= 15) {
    return 15;
  }
  if (value >= 10) {
    return 10;
  }

  return 5;
}

function redirectWithNotice(notice: string): never {
  redirect(`/?notice=${encodeURIComponent(notice)}`);
}
