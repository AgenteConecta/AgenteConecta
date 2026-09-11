"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/integrations/supabase/client";
import { getProspectingAudience, parseCustomKeywords } from "@/features/prospecting/audiences";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { persistDiscoveredLead } from "@/features/leads/lead-repository";
import { hasMinimumIcpSignal } from "@/features/prospecting/icp-filter";
import { discoverProfilesFromHashtag, discoverProfilesFromInfluencerNetwork, readInstagramPublicProfile } from "@/integrations/instagram/browser-worker";
import { runAutomaticQualifiedOutreach } from "@/features/outreach/outreach-actions";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import { isOperationallyPaused } from "@/features/safety/operation-pause";
import { saveProspectingDefaults } from "@/features/prospecting/prospecting-settings";

export type ProspectingRunSummary = {
  id: string;
  status: string;
  audienceLabel: string;
  keywords: string[];
  createdAt: string | null;
  updatedAt: string | null;
  lastError: string | null;
  summary: {
    discovered?: number;
    persisted?: number;
    duplicates?: number;
    filteredOut?: number;
    errors?: number;
    paused?: boolean;
    targetNewLeads?: number | null;
    skippedKnown?: number;
    targetReached?: boolean;
  } | null;
};

export async function queueProspectingRun(formData: FormData) {
  const audience = getProspectingAudience(String(formData.get("audience") ?? "auto"));
  const audienceId = String(formData.get("audience") ?? audience.id);
  const audienceLabel = String(formData.get("audienceLabel") ?? audience.label).trim() || audience.label;
  const searchMode = String(formData.get("searchMode") ?? "keywords") === "influencer_network" ? "influencer_network" : "keywords";
  const customKeywords = parseCustomKeywords(String(formData.get("keywords") ?? ""));
  const influencerProfiles = parseCustomKeywords(String(formData.get("influencerProfiles") ?? ""));
  const maxProfilesRaw = Number(formData.get("maxProfiles") ?? 15);
  const maxProfilesPerKeyword = Math.max(1, Math.min(Number.isFinite(maxProfilesRaw) ? maxProfilesRaw : 15, 50));
  const targetNewLeadsRaw = Number(formData.get("targetNewLeads") ?? 15);
  const targetNewLeads = Math.max(1, Math.min(Number.isFinite(targetNewLeadsRaw) ? targetNewLeadsRaw : 15, 15));
  const stopAtTarget = formData.get("stopAtTarget") === "on";
  const keywords = (customKeywords.length > 0 ? customKeywords : audience.keywords).slice(0, 12);
  const runNow = formData.get("runNow") === "on";
  const autoContact = formData.get("autoContact") === "on";
  const saveConfig = formData.get("saveConfig") === "on";
  const minScoreRaw = Number(formData.get("minScore") ?? 70);
  const minFollowersRaw = Number(formData.get("minFollowers") ?? 10000);
  const batchSizeRaw = Number(formData.get("batchSize") ?? 5);
  const minScore = Math.max(0, Math.min(Number.isFinite(minScoreRaw) ? minScoreRaw : 70, 100));
  const minFollowers = Math.max(0, Math.min(Number.isFinite(minFollowersRaw) ? minFollowersRaw : 10000, 10_000_000));
  const batchSize = normalizeBatchSize(batchSizeRaw);
  const appMode = await getOperationalAppMode();

  if (saveConfig) {
    await saveProspectingDefaults({
      audienceId,
      searchMode,
      audienceLabel,
      keywords,
      influencerProfiles,
      targetNewLeads,
      maxProfilesPerKeyword,
      stopAtTarget,
      autoContact,
      minScore,
      minFollowers,
      batchSize,
    });
  }

  if (await isOperationallyPaused()) {
    redirectWithNotice("Master pause ativo. Desative a pausa antes de iniciar uma nova prospecção.");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirectWithNotice("Supabase não está configurado. A prospecção não foi enfileirada.");
  }

  const idempotencySource = searchMode === "influencer_network" ? influencerProfiles : keywords;

  if (searchMode === "influencer_network" && influencerProfiles.length === 0) {
    redirectWithNotice("Informe ao menos um perfil-base de influenciador para pesquisar contatos qualificados.");
  }

  const idempotencyKey = `discover:${searchMode}:${audienceId}:${idempotencySource.join("|").toLowerCase()}:${maxProfilesPerKeyword}:${stopAtTarget ? targetNewLeads : "open"}:${new Date().toISOString().slice(0, 13)}`;
  const { data: job, error } = await supabase.from("jobs").upsert(
    {
      type: "discover_leads",
      status: "queued",
      idempotency_key: idempotencyKey,
      max_attempts: 1,
      payload: {
        audienceId,
        searchMode,
        audienceLabel,
        keywords,
        influencerProfiles,
        maxProfilesPerKeyword,
        targetNewLeads: stopAtTarget ? targetNewLeads : null,
        stopAtTarget,
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
    await supabase.from("jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", job.id);

    const summary = await runProspectingKeywords({
      searchMode,
      keywords,
      influencerProfiles,
      audienceLabel,
      maxProfilesPerKeyword,
      targetNewLeads: stopAtTarget ? targetNewLeads : null,
      knownUsernames: await getKnownInstagramUsernames(),
    });
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
        payload: {
          audienceId,
          searchMode,
          audienceLabel,
          keywords,
          influencerProfiles,
          maxProfilesPerKeyword,
          targetNewLeads: stopAtTarget ? targetNewLeads : null,
          targetNewQualifiedLeads: stopAtTarget ? targetNewLeads : null,
          stopAtTarget,
          autoContact,
          minScore,
          minFollowers,
          batchSize,
          source: "dashboard",
          dryRun: appMode === "dry_run",
          summary,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    revalidatePath("/");
    revalidatePath("/leads");
    const emptyReason = summary.discovered === 0 ? " Nenhum perfil foi capturado no Instagram para essas buscas; tente palavras mais amplas ou verifique se o Chrome logado está carregando resultados." : "";
    redirectWithNotice(
      `Prospecção concluída (${searchMode === "influencer_network" ? "rede de influenciador" : "buscas por termos"}): ${summary.discovered} encontrados, ${summary.persisted} novos qualificados salvos, ${summary.duplicates} repetidos, ${summary.skippedKnown} já conhecidos pulados, ${summary.filteredOut} filtrados, ${summary.errors} erros. Meta: ${summary.targetNewLeads ?? "sem limite"} qualificados${summary.targetReached ? " (atingida)" : ""}. Contato automático: ${outreachSummary.prepared} criados, ${outreachSummary.processed} processados.${saveConfig ? " Configuração salva para próximas pesquisas." : ""}${emptyReason}`,
    );
  }

  revalidatePath("/");
  redirectWithNotice(`Prospecção enfileirada: ${audienceLabel} com ${searchMode === "influencer_network" ? influencerProfiles.length : keywords.length} entradas. ${saveConfig ? "Configuração salva para próximas pesquisas. " : ""}Modo dry-run: nenhum contato será enviado.`);
}

async function runProspectingKeywords({
  searchMode,
  keywords,
  influencerProfiles,
  audienceLabel,
  maxProfilesPerKeyword,
  targetNewLeads,
  knownUsernames,
}: {
  searchMode: "keywords" | "influencer_network";
  keywords: string[];
  influencerProfiles: string[];
  audienceLabel: string;
  maxProfilesPerKeyword: number;
  targetNewLeads: number | null;
  knownUsernames: Set<string>;
}) {
  const summary = {
    discovered: 0,
    persisted: 0,
    duplicates: 0,
    skippedKnown: 0,
    filteredOut: 0,
    errors: 0,
    paused: false,
    targetNewLeads,
    targetReached: false,
    diagnostics: [] as string[],
    errorMessage: null as string | null,
  };

  const searchEntries = searchMode === "influencer_network" ? influencerProfiles : keywords;

  const maxRounds = targetNewLeads ? Math.max(2, Math.ceil(targetNewLeads / Math.max(searchEntries.length, 1)) + 3) : 1;
  let round = 0;

  while (searchEntries.length > 0 && round < maxRounds) {
    round += 1;
    let savedThisRound = 0;

    for (const keyword of searchEntries) {
      if (targetNewLeads && summary.persisted >= targetNewLeads) {
        summary.targetReached = true;
        break;
      }

      if (await isOperationallyPaused()) {
        summary.paused = true;
        break;
      }

      const remainingTarget = targetNewLeads ? Math.max(targetNewLeads - summary.persisted, 1) : maxProfilesPerKeyword;
      const profilesToRequest = Math.min(Math.max(maxProfilesPerKeyword, Math.ceil(remainingTarget * 2.5), 15), 50);
      const discovered = await (searchMode === "influencer_network"
        ? discoverProfilesFromInfluencerNetwork({ profile: keyword, audienceLabel, maxProfiles: profilesToRequest })
        : discoverProfilesFromHashtag({ keyword, maxProfiles: profilesToRequest })
      ).catch((error: unknown) => {
        summary.errors += 1;
        summary.errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao pesquisar no Instagram.";
        return [];
      });

      summary.discovered += discovered.length;
      summary.diagnostics.push(`rodada ${round} / ${keyword}: ${discovered.length} perfil(is) encontrado(s)`);

      for (const lead of discovered) {
        if (targetNewLeads && summary.persisted >= targetNewLeads) {
          summary.targetReached = true;
          break;
        }

        if (await isOperationallyPaused()) {
          summary.paused = true;
          break;
        }

        const normalizedUsername = normalizeInstagramUsername(lead.instagramUsername);
        if (knownUsernames.has(normalizedUsername)) {
          summary.duplicates += 1;
          summary.skippedKnown += 1;
          summary.diagnostics.push(`${lead.instagramUsername}: pulado porque já existe no CRM`);
          continue;
        }

        const enrichedLead = await withTimeout(
          readInstagramPublicProfile(lead.instagramUsername)
            .then((profile) => ({
              ...lead,
              ...profile,
              discoverySource: lead.discoverySource,
              discoveryKeyword: lead.discoveryKeyword,
            }))
            .catch(() => lead),
          20000,
          lead,
        );

        if (!hasMinimumIcpSignal(enrichedLead)) {
          summary.filteredOut += 1;
          summary.diagnostics.push(`${lead.instagramUsername}: filtrado antes de salvar por baixa aderência`);
          knownUsernames.add(normalizedUsername);
          continue;
        }

        const persistence = await persistDiscoveredLead(enrichedLead).catch((error: unknown) => {
          summary.errors += 1;
          summary.errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao salvar lead.";
          summary.diagnostics.push(`${lead.instagramUsername}: falha ao salvar (${summary.errorMessage})`);
          return null;
        });

        if (!persistence) {
          continue;
        }

        generateFirstContactMessage(enrichedLead, persistence.score);

        if (persistence.duplicateLeadId) {
          summary.duplicates += 1;
          knownUsernames.add(normalizedUsername);
        } else if (persistence.mode === "persisted") {
          summary.persisted += 1;
          savedThisRound += 1;
          knownUsernames.add(normalizedUsername);
        }
      }

      if (summary.paused) {
        break;
      }
    }

    if (summary.paused || summary.targetReached || !targetNewLeads || savedThisRound === 0) {
      break;
    }
  }

  return summary;
}

async function getKnownInstagramUsernames() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return new Set<string>();
  }

  const { data } = await supabase.from("leads").select("instagram_username").not("instagram_username", "is", null);
  return new Set((data ?? []).map((lead) => normalizeInstagramUsername(String(lead.instagram_username ?? ""))).filter(Boolean));
}

function normalizeInstagramUsername(username: string) {
  return username.replace(/^@/, "").trim().toLowerCase();
}

export async function listRecentProspectingRuns(): Promise<ProspectingRunSummary[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id, status, payload, created_at, updated_at, last_error")
    .eq("type", "discover_leads")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    throw error;
  }

  return (data ?? []).map((job) => {
    const payload = (job.payload ?? {}) as {
      audienceLabel?: string;
      keywords?: string[];
      summary?: ProspectingRunSummary["summary"];
    };

    return {
      id: job.id as string,
      status: String(job.status ?? "queued"),
      audienceLabel: payload.audienceLabel ?? "Público não identificado",
      keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
      createdAt: (job.created_at as string | null) ?? null,
      updatedAt: (job.updated_at as string | null) ?? null,
      lastError: (job.last_error as string | null) ?? null,
      summary: payload.summary ?? null,
    };
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
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
