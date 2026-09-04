import {
  Activity,
  BadgeCheck,
  Bot,
  BriefcaseBusiness,
  Clock3,
  CircleDollarSign,
  Database,
  Flame,
  Gauge,
  GraduationCap,
  Handshake,
  Lock,
  MessageCircle,
  PauseCircle,
  Play,
  Search,
  Send,
  Smartphone,
} from "lucide-react";
import { formatBRL, loadBusinessConfig } from "@/lib/business-config";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { requiredTables } from "@/db/schema-notes";
import { getDashboardData } from "@/features/analytics/dashboard-data";
import { AppShell } from "@/components/app-shell";
import { ChromeInstagramControls } from "@/components/chrome-instagram-controls";
import { OperationalModeSwitch } from "@/components/operational-mode-switch";
import { prospectingAudiences } from "@/features/prospecting/audiences";
import { ProspectingLauncher } from "@/components/prospecting-launcher";
import { listRecentProspectingRuns, queueProspectingRun, type ProspectingRunSummary } from "@/features/prospecting/prospecting-actions";
import { getLeadStorageStats, listLeadsForReview, type LeadStorageStats } from "@/features/leads/review-repository";
import { getApprovedOutreachCount, getAutomaticOutreachCandidateCount, processApprovedOutreach, processAutomaticQualifiedOutreach } from "@/features/outreach/outreach-actions";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import { getOperationalPause, resumeAllWork, suspendAllWork } from "@/features/safety/operation-pause";
import { identifyProspectingLane, type ProspectingLane } from "@/features/prospecting/prospecting-lane";
import { scoreLead } from "@/features/scoring/scoring";
import type { DashboardData, DashboardLead } from "@/features/analytics/dashboard-data";

type SearchParams = Promise<{
  notice?: string;
}>;

const sampleLead = {
  instagramUsername: "@automax_integracoes",
  displayName: "Automax Integrações",
  bio: "Empresa de automação residencial em São Paulo. Projetos alto padrão com Control4, iluminação e infraestrutura.",
  category: "Empresa de automação",
  city: "São Paulo",
  state: "SP",
  country: "Brasil",
  website: "https://automax.example",
  posts: ["Projeto em andamento para casa inteligente alto padrão", "Painel de automação centralizada"],
  discoverySource: "instagram_keyword",
  discoveryKeyword: "automação centralizada",
};

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink/65">{title}</span>
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-normal text-ink">{value}</div>
    </div>
  );
}

type Stage = {
  label: string;
  match: (lead: DashboardLead) => boolean;
  href: string;
};

const contactedStates = new Set(["approved_for_outreach", "auto_outreach_qualified", "outreach_prepared", "operator_confirmation_required"]);
const closedStates = new Set(["rejected", "do_not_contact"]);

function toLeadInput(lead: DashboardLead) {
  return {
    instagramUsername: `@${lead.instagram_username ?? ""}`,
    displayName: lead.display_name ?? lead.instagram_username ?? "Lead",
    bio: lead.bio ?? "",
    city: lead.city ?? undefined,
    state: lead.state ?? undefined,
    discoveryKeyword: lead.discovery_keyword ?? undefined,
  };
}

function laneForLead(lead: DashboardLead): ProspectingLane {
  const input = toLeadInput(lead);
  const computedScore = scoreLead(input);

  return identifyProspectingLane(input, {
    ...computedScore,
    leadScore: lead.lead_score ?? computedScore.leadScore,
    commercialValueScore: lead.commercial_value_score ?? computedScore.commercialValueScore,
    leadType:
      lead.lead_type === "learner" || lead.lead_type === "professional" || lead.lead_type === "business"
        ? lead.lead_type
        : computedScore.leadType,
  });
}

function stagesForLane(lane: ProspectingLane): Stage[] {
  const laneQuery = `lane=${lane}`;

  return [
    {
      label: "Todos os leads",
      match: () => true,
      href: `/leads?${laneQuery}&status=all`,
    },
    {
      label: "Novos",
      match: (lead) => (lead.channel_state ?? "none") === "none",
      href: `/leads?${laneQuery}&status=none`,
    },
    {
      label: "Qualificados",
      match: (lead) => Number(lead.lead_score ?? 0) >= 50,
      href: `/leads?${laneQuery}&status=qualified`,
    },
    {
      label: "Abordagem/contato",
      match: (lead) => contactedStates.has(lead.channel_state ?? ""),
      href: `/leads?${laneQuery}&status=contacted`,
    },
    {
      label: "Parceria",
      match: (lead) => lead.channel_state === "partnership_review",
      href: `/leads?${laneQuery}&status=partnership_review`,
    },
    {
      label: "Nutrir depois",
      match: (lead) => lead.channel_state === "nurture_later",
      href: `/leads?${laneQuery}&status=nurture_later`,
    },
    {
      label: "Encerrados",
      match: (lead) => closedStates.has(lead.channel_state ?? ""),
      href: `/leads?${laneQuery}&status=closed`,
    },
  ];
}

function FunnelPreview({ title, lane, leads }: { title: string; lane: ProspectingLane; leads: DashboardLead[] }) {
  const laneLeads = leads.filter((lead) => laneForLead(lead) === lane);
  const stages = stagesForLane(lane);

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <a className="inline-flex h-9 items-center justify-center rounded-md border border-black/10 px-3 text-sm font-medium text-ink/70" href={`/leads?lane=${lane}`}>
          Ver leads
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        {stages.map((stage) => (
          <a className="min-h-20 rounded-md border border-black/10 bg-[#f7f8f5] p-3 transition hover:border-pine/30 hover:bg-mint/70" href={stage.href} key={stage.label}>
            <div className="text-xs font-medium text-ink/65">{stage.label}</div>
            <div className="mt-3 text-xl font-semibold">{laneLeads.filter(stage.match).length}</div>
            <div className="mt-1 text-xs text-pine">Abrir lista</div>
          </a>
        ))}
      </div>
    </section>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "completed") {
    return "bg-mint text-pine";
  }
  if (status === "running" || status === "queued") {
    return "bg-sky/10 text-sky";
  }
  return "bg-coral/10 text-coral";
}

function LeadStoragePanel({ stats, runs }: { stats: LeadStorageStats; runs: ProspectingRunSummary[] }) {
  const typeLabels = {
    business: "Empresas",
    professional: "Profissionais",
    learner: "Treinamento",
    unknown: "Indefinidos",
  };

  return (
    <section className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-panel xl:grid-cols-[360px_1fr]">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-pine">
          <Database className="h-4 w-4" />
          Banco acumulado
        </div>
        <h2 className="mt-2 text-xl font-semibold">Leads salvos para campanhas</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
            <div className="text-xs text-ink/55">Total</div>
            <div className="text-2xl font-semibold">{stats.total}</div>
          </div>
          <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
            <div className="text-xs text-ink/55">Qualificados</div>
            <div className="text-2xl font-semibold">{stats.qualified}</div>
          </div>
          <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
            <div className="text-xs text-ink/55">Hoje</div>
            <div className="text-2xl font-semibold">{stats.discoveredToday}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Object.entries(stats.byType).map(([type, count]) => (
            <a className="rounded-md border border-black/10 bg-[#f7f8f5] px-3 py-2 text-sm transition hover:bg-mint/70" href={`/leads?lane=all&status=all&type=${type}`} key={type}>
              <div className="text-xs text-ink/55">{typeLabels[type as keyof typeof typeLabels]}</div>
              <div className="text-lg font-semibold">{count}</div>
            </a>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-pine">
            <Clock3 className="h-4 w-4" />
            Últimas buscas
          </div>
          <a className="text-sm font-semibold text-pine" href="/leads">
            Abrir leads
          </a>
        </div>
        <div className="overflow-hidden rounded-md border border-black/10">
          {runs.length > 0 ? (
            <div className="divide-y divide-black/10">
              {runs.map((run) => (
                <div className="grid gap-3 bg-[#f7f8f5] px-3 py-3 md:grid-cols-[1fr_130px_170px]" key={run.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{run.audienceLabel}</span>
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusTone(run.status)}`}>{run.status}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-ink/55">{run.keywords.join(", ") || "sem palavras-chave"}</div>
                    {run.lastError ? <div className="mt-1 text-xs font-semibold text-coral">{run.lastError}</div> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-ink/65">
                    <span>Achados: {run.summary?.discovered ?? 0}</span>
                    <span>Novos: {run.summary?.persisted ?? 0}</span>
                    <span>Repetidos: {run.summary?.duplicates ?? 0}</span>
                    <span>Erros: {run.summary?.errors ?? 0}</span>
                  </div>
                  <div className="text-xs text-ink/55">
                    <div>Início: {formatDateTime(run.createdAt)}</div>
                    <div>Atualizado: {formatDateTime(run.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#f7f8f5] px-3 py-4 text-sm text-ink/60">Nenhuma busca registrada ainda.</div>
          )}
        </div>
      </div>
    </section>
  );
}

const emptyDashboard: DashboardData = {
  connected: false,
  metrics: {
    leadsDiscoveredToday: 0,
    qualifiedLeads: 0,
    dmsSent: 0,
    responses: 0,
    whatsappStarted: 0,
    trainingSales: 0,
    credentialingSales: 0,
    credentialedPartners: 0,
    activeResellers: 0,
    attributedRevenue: 0,
    openAiCost: 0,
  },
  hotLead: null,
  recentLeads: [],
};

const emptyLeadStorageStats: LeadStorageStats = {
  total: 0,
  qualified: 0,
  discoveredToday: 0,
  byType: {
    business: 0,
    professional: 0,
    learner: 0,
    unknown: 0,
  },
};

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const business = loadBusinessConfig();
  const [dashboard, approvedOutreachCount, automaticCandidateCount, appMode, pause, allLeads, leadStorageStats, recentProspectingRuns] = await Promise.all([
    getDashboardData().catch(() => emptyDashboard),
    getApprovedOutreachCount().catch(() => 0),
    getAutomaticOutreachCandidateCount().catch(() => 0),
    getOperationalAppMode().catch(() => "dry_run" as const),
    getOperationalPause().catch(() => ({ paused: false, reason: "Sem pausa operacional", source: "none" as const })),
    listLeadsForReview({}).catch(() => []),
    getLeadStorageStats().catch(() => emptyLeadStorageStats),
    listRecentProspectingRuns().catch(() => []),
  ]);
  const hotLead = dashboard.hotLead;
  const hotLeadInput = hotLead
    ? {
        instagramUsername: `@${hotLead.instagram_username ?? ""}`,
        displayName: hotLead.display_name ?? hotLead.instagram_username ?? "Lead",
        bio: hotLead.bio ?? "",
        city: hotLead.city ?? undefined,
        state: hotLead.state ?? undefined,
        discoveryKeyword: hotLead.discovery_keyword ?? undefined,
      }
    : sampleLead;
  const firstMessage = generateFirstContactMessage(hotLeadInput, {
    rawLeadScore: hotLead?.lead_score ?? 0,
    leadScore: hotLead?.lead_score ?? 0,
    commercialValueScore: hotLead?.commercial_value_score ?? 0,
    leadType: hotLead?.lead_type === "business" || hotLead?.lead_type === "professional" || hotLead?.lead_type === "learner" ? hotLead.lead_type : "unknown",
    marketAwareness:
      hotLead?.market_awareness === "competing_solution_user" ||
      hotLead?.market_awareness === "professional_integrator" ||
      hotLead?.market_awareness === "solution_aware" ||
      hotLead?.market_awareness === "automation_aware" ||
      hotLead?.market_awareness === "problem_aware"
        ? hotLead.market_awareness
        : "unaware",
    geographyTier: "tier_3",
    territoryOpportunityScore: 0,
    projectReadiness: "unknown",
    businessType: hotLead?.lead_type ?? "unknown",
    estimatedRole: "unknown",
    scoreExplanation: [],
    commercialExplanation: [],
  });
  const responseRate = dashboard.metrics.dmsSent > 0 ? `${Math.round((dashboard.metrics.responses / dashboard.metrics.dmsSent) * 100)}%` : "0%";

  const metrics = [
    ["Leads descobertos hoje", String(dashboard.metrics.leadsDiscoveredToday), Search, "text-pine"],
    ["Leads qualificados", String(dashboard.metrics.qualifiedLeads), Gauge, "text-sky"],
    ["DMs enviadas", String(dashboard.metrics.dmsSent), Send, "text-coral"],
    ["Taxa de resposta", responseRate, MessageCircle, "text-pine"],
    ["Interessados", String(dashboard.metrics.responses), Flame, "text-coral"],
    ["WhatsApps iniciados", String(dashboard.metrics.whatsappStarted), Smartphone, "text-sky"],
    [`Vendas ${formatBRL(business.offers.basicTraining.priceBRL)}`, String(dashboard.metrics.trainingSales), GraduationCap, "text-pine"],
    [`Vendas ${formatBRL(business.offers.credentialing.priceBRL)}`, String(dashboard.metrics.credentialingSales), BriefcaseBusiness, "text-pine"],
    ["Credenciamentos", String(dashboard.metrics.credentialedPartners), BadgeCheck, "text-sky"],
    ["Revendedores ativos", String(dashboard.metrics.activeResellers), Handshake, "text-pine"],
    ["Receita atribuída", formatBRL(dashboard.metrics.attributedRevenue), CircleDollarSign, "text-amber"],
    ["Custo OpenAI", `US$ ${dashboard.metrics.openAiCost.toFixed(2)}`, Bot, "text-ink"],
  ] as const;

  return (
    <AppShell active="Visão Geral" operationMode={appMode}>
        <header className="border-b border-black/10 bg-white px-5 py-4 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-pine">{business.company.name}</p>
              <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Sistema Comercial Autônomo</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={suspendAllWork}>
                <button className="inline-flex items-center gap-2 rounded-md border border-coral/30 bg-white px-3 py-2 text-sm font-medium text-coral transition hover:bg-coral hover:text-white">
                  <PauseCircle className="h-4 w-4" />
                  Suspender agora
                </button>
              </form>
              <form action={resumeAllWork}>
                <button className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-mint hover:text-pine">
                  <Play className="h-4 w-4" />
                  Retomar
                </button>
              </form>
              <span className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${pause.paused ? "bg-coral text-white" : "border border-pine/20 bg-mint text-pine"}`}>
                <PauseCircle className="h-4 w-4" />
                Pausa geral: {pause.paused ? "ativa" : "inativa"}
              </span>
            </div>
          </div>
          <OperationalModeSwitch currentMode={appMode} />
          <ChromeInstagramControls />
          {params.notice ? (
            <div className="mt-4 rounded-md border border-pine/20 bg-mint px-4 py-3 text-sm font-medium text-pine">
              {params.notice}
            </div>
          ) : null}
        </header>

        <div className="space-y-6 px-5 py-6 md:px-8">
          <ProspectingLauncher action={queueProspectingRun} audiences={prospectingAudiences} />
          <LeadStoragePanel stats={leadStorageStats} runs={recentProspectingRuns} />

          <section className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-panel lg:grid-cols-[1fr_360px]">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-pine">
                <Send className="h-4 w-4" />
                Contatos aprovados
              </div>
              <h2 className="mt-2 text-xl font-semibold">Processar abordagens aprovadas</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
                Pega as mensagens aprovadas em Leads, respeita bloqueios de contato e registra o resultado no pipeline. Em dry-run, valida tudo sem enviar DM.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
                  <div className="text-xs text-ink/55">Na fila</div>
                  <div className="text-2xl font-semibold">{approvedOutreachCount}</div>
                </div>
                <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
                  <div className="text-xs text-ink/55">Modo</div>
                  <div className="text-sm font-semibold">{appMode}</div>
                </div>
                <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
                  <div className="text-xs text-ink/55">Envio real</div>
                  <div className="text-sm font-semibold">{appMode === "dry_run" || appMode === "simulation" ? "bloqueado" : "confirmação"}</div>
                </div>
              </div>
            </div>
            <form action={processApprovedOutreach} className="grid content-start gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase text-ink/45">Processar até</span>
                <input className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={5} min={1} max={10} name="maxMessages" type="number" />
              </label>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-pine px-4 text-sm font-medium text-white transition hover:brightness-95 active:scale-[0.99]">
                <Send className="h-4 w-4" />
                Enviar contatos aprovados
              </button>
              <a className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 px-4 text-sm font-medium text-ink/70" href="/leads">
                Revisar leads
              </a>
            </form>
          </section>

          <section className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-panel lg:grid-cols-[1fr_360px]">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-pine">
                <Bot className="h-4 w-4" />
                Contato automático qualificado
              </div>
              <h2 className="mt-2 text-xl font-semibold">Contatar por score ou seguidores</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
                Seleciona leads ainda não contatados quando atingem o score mínimo ou o mínimo de seguidores capturado no perfil. Respeita do-not-contact e registra tudo no pipeline.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
                  <div className="text-xs text-ink/55">Candidatos por score 70+</div>
                  <div className="text-2xl font-semibold">{automaticCandidateCount}</div>
                </div>
                <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
                  <div className="text-xs text-ink/55">Envio real</div>
                  <div className="text-sm font-semibold">{appMode === "dry_run" || appMode === "simulation" ? "bloqueado" : "confirmação"}</div>
                </div>
                <div className="rounded-md bg-[#f7f8f5] px-3 py-2">
                  <div className="text-xs text-ink/55">Lotes disponíveis</div>
                  <div className="text-sm font-semibold">5, 10 ou 15 leads</div>
                </div>
              </div>
            </div>
            <form action={processAutomaticQualifiedOutreach} className="grid content-start gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase text-ink/45">Score mínimo</span>
                <input className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={70} min={0} max={100} name="minScore" type="number" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase text-ink/45">Seguidores mínimos</span>
                <input className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={10000} min={0} max={10000000} name="minFollowers" type="number" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase text-ink/45">Lote</span>
                <select className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={5} name="batchSize">
                  <option value={5}>5 leads</option>
                  <option value={10}>10 leads</option>
                  <option value={15}>15 leads</option>
                </select>
              </label>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:brightness-95 active:scale-[0.99]">
                <Bot className="h-4 w-4" />
                Contatar automaticamente
              </button>
              <div className="rounded-md bg-[#f7f8f5] px-3 py-2 text-xs leading-5 text-ink/60">
                Use valores conservadores no começo. Em dry-run, o contato é criado e processado sem envio real.
              </div>
            </form>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(([title, value, Icon, tone]) => (
              <MetricCard key={title} title={title} value={value} icon={Icon} tone={tone} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Lead quente — revisar agora</h2>
                <Flame className="h-5 w-5 text-coral" />
              </div>
              <div className="grid gap-5 md:grid-cols-[1fr_220px]">
                <div>
                  <div className="text-2xl font-semibold">{hotLeadInput.displayName}</div>
                  <div className="mt-1 text-sm text-ink/65">
                    {hotLeadInput.city ?? "Cidade não identificada"}/{hotLeadInput.state ?? "UF"} · {hotLead?.lead_type ?? "tipo pendente"} ·{" "}
                    {hotLead?.market_awareness ?? "awareness pendente"} · {hotLead?.discovery_keyword ?? "origem pendente"}
                  </div>
                  <div className="mt-5 rounded-md bg-[#f7f8f5] p-4">
                    <div className="text-sm font-medium text-ink/70">Primeira abordagem gerada</div>
                    <p className="mt-2 text-sm leading-6">{firstMessage}</p>
                  </div>
                  {hotLead ? (
                    <a
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-pine px-4 text-sm font-medium text-white transition hover:brightness-95"
                      href={`/leads?selected=${hotLead.id}`}
                    >
                      Abrir ficha do lead
                    </a>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                  <div className="rounded-md bg-mint p-4">
                    <div className="text-sm text-pine">Lead Score</div>
                    <div className="text-3xl font-semibold text-pine">{hotLead?.lead_score ?? 0}</div>
                  </div>
                  <div className="rounded-md bg-[#fff4d9] p-4">
                    <div className="text-sm text-ink/70">Commercial Value</div>
                    <div className="text-3xl font-semibold">{hotLead?.commercial_value_score ?? 0}</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {dashboard.recentLeads.slice(0, 6).map((lead) => (
                  <a
                    className="flex items-center justify-between rounded-md border border-black/10 px-3 py-2 text-sm transition hover:border-pine/30 hover:bg-mint/70"
                    href={`/leads?selected=${lead.id}`}
                    key={lead.id}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">@{lead.instagram_username}</span>
                      <span className="block truncate text-xs text-ink/45">{lead.discovery_keyword ?? "sem busca"}</span>
                    </span>
                    <span className="font-semibold text-pine">{lead.lead_score ?? 0}/{lead.commercial_value_score ?? 0}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Controles de segurança</h2>
                <Lock className="h-5 w-5 text-pine" />
              </div>
              {[
                ["Master pause", "Disponível no painel"],
                ["Do not contact", "Permanente até revisão manual"],
                ["Browser", "Restrito a instagram.com"],
                ["Channel owner", "Transacional no banco"],
                ["Claims", "Somente status verified"],
                ["OpenAI", "Pausa por orçamento mensal"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-black/10 py-3 text-sm last:border-b-0">
                  <span className="font-medium">{label}</span>
                  <span className="text-right text-ink/65">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <FunnelPreview title="Leads para treinamento" lane="training" leads={allLeads} />
            <FunnelPreview title="Leads para credenciamento" lane="credentialing" leads={allLeads} />
            <FunnelPreview title="Leads para equipamentos" lane="equipment" leads={allLeads} />
            <FunnelPreview title="Leads para parceria/divulgação" lane="partnership" leads={allLeads} />
          </section>

          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">Banco e integrações</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {requiredTables.map((table) => (
                <div key={table} className="rounded-md bg-[#f7f8f5] px-3 py-2 text-sm text-ink/75">
                  {table}
                </div>
              ))}
            </div>
          </section>
        </div>
    </AppShell>
  );
}
