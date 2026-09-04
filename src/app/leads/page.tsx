import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Handshake,
  MessageSquareText,
  Search,
  Sparkles,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { generateFirstContactVariants } from "@/features/conversations/first-contact";
import { approveLeadForOutreach, listLeadPipeline, listLeadsForReview, updateLeadReviewState } from "@/features/leads/review-repository";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import { identifyProspectingLane, prospectingLaneLabel, type ProspectingLane } from "@/features/prospecting/prospecting-lane";
import { scoreLead } from "@/features/scoring/scoring";

type SearchParams = Promise<{
  q?: string;
  minScore?: string;
  lane?: string;
  status?: string;
  selected?: string;
  notice?: string;
}>;

type LeadRow = Awaited<ReturnType<typeof listLeadsForReview>>[number];

function scoreTone(score: number) {
  if (score >= 70) {
    return "bg-pine text-white";
  }
  if (score >= 35) {
    return "bg-amber text-ink";
  }
  return "bg-[#e8ebe3] text-ink/70";
}

function statusLabel(state?: string | null) {
  const labels: Record<string, string> = {
    none: "Novo",
    approved_for_outreach: "Aprovado",
    partnership_review: "Parceria",
    nurture_later: "Nutrir depois",
    rejected: "Descartado",
    do_not_contact: "Não contatar",
  };

  return labels[state ?? "none"] ?? state ?? "Novo";
}

function leadTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    business: "Empresa",
    professional: "Profissional",
    learner: "Aluno/treinamento",
    unknown: "Indefinido",
  };

  return labels[type ?? "unknown"] ?? type ?? "Indefinido";
}

function formatFollowers(value?: number | null) {
  if (!value) {
    return "-";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }

  return String(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function freshnessLabel(lead: LeadRow) {
  const count = lead.prospecting_count ?? 0;
  if (count > 1) {
    return `Reencontrado ${count}x`;
  }

  return "Novo";
}

function toLeadInput(lead: LeadRow) {
  return {
    instagramUsername: `@${lead.instagram_username ?? ""}`,
    displayName: lead.display_name ?? lead.instagram_username ?? "Lead",
    bio: lead.bio ?? "",
    city: lead.city ?? undefined,
    state: lead.state ?? undefined,
    discoveryKeyword: lead.discovery_keyword ?? undefined,
  };
}

function laneForLead(lead: LeadRow): ProspectingLane {
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

function ReviewAction({
  lead,
  lane,
  action,
  label,
  icon: Icon,
  tone,
  returnTo,
}: {
  lead: LeadRow;
  lane: ProspectingLane;
  action: string;
  label: string;
  icon: typeof CheckCircle2;
  tone: string;
  returnTo: string;
}) {
  return (
    <form action={action === "approve" ? approveLeadForOutreach : updateLeadReviewState}>
      <input name="leadId" type="hidden" value={lead.id} />
      <input name="lane" type="hidden" value={lane} />
      <input name="username" type="hidden" value={`@${lead.instagram_username ?? ""}`} />
      <input name="action" type="hidden" value={action} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <button className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition hover:brightness-95 active:scale-[0.99] ${tone}`}>
        <Icon className="h-4 w-4" />
        {label}
      </button>
    </form>
  );
}

function ApprovalMessageForm({
  lead,
  lane,
  message,
  returnTo,
}: {
  lead: LeadRow;
  lane: ProspectingLane;
  message: string;
  returnTo: string;
}) {
  return (
    <form action={approveLeadForOutreach} className="space-y-3">
      <input name="leadId" type="hidden" value={lead.id} />
      <input name="lane" type="hidden" value={lane} />
      <input name="username" type="hidden" value={`@${lead.instagram_username ?? ""}`} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase text-ink/45">Mensagem para aprovar</span>
        <textarea
          className="min-h-40 w-full resize-y rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-pine"
          defaultValue={message}
          name="approvedMessage"
        />
      </label>
      <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-pine px-3 text-sm font-medium text-white transition hover:brightness-95 active:scale-[0.99]">
        <CheckCircle2 className="h-4 w-4" />
        Aprovar abordagem editada
      </button>
    </form>
  );
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const appMode = await getOperationalAppMode();
  const leads = await listLeadsForReview({
    q: params.q,
    minScore: params.minScore ? Number(params.minScore) : undefined,
    status: params.status,
  });

  const rows = leads
    .map((lead) => ({
      lead,
      lane: laneForLead(lead),
      input: toLeadInput(lead),
    }))
    .filter((row) => !params.lane || params.lane === "all" || row.lane === params.lane);

  const selected = rows.find((row) => row.lead.id === params.selected) ?? rows[0] ?? null;
  const selectedApproaches = selected ? generateFirstContactVariants(selected.input, scoreLead(selected.input)) : [];
  const returnTo = `/leads?q=${params.q ?? ""}&minScore=${params.minScore ?? ""}&lane=${params.lane ?? "all"}&status=${params.status ?? "all"}${selected ? `&selected=${selected.lead.id}` : ""}`;
  const pipeline = selected ? await listLeadPipeline(selected.lead.id) : [];
  const counts = rows.reduce(
    (acc, row) => {
      acc[row.lane] += 1;
      return acc;
    },
    { training: 0, credentialing: 0, equipment: 0, partnership: 0, review: 0 } satisfies Record<ProspectingLane, number>,
  );
  const typeCounts = rows.reduce(
    (acc, row) => {
      const type = row.lead.lead_type === "business" || row.lead.lead_type === "professional" || row.lead.lead_type === "learner" ? row.lead.lead_type : "unknown";
      acc[type] += 1;
      return acc;
    },
    { business: 0, professional: 0, learner: 0, unknown: 0 },
  );

  return (
    <AppShell active="Leads" operationMode={appMode}>
      <header className="border-b border-black/10 bg-white px-5 py-4 md:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium text-pine">CRM de prospecção</p>
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Mesa de revisão de leads</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(counts).map(([lane, count]) => (
              <div key={lane} className="rounded-md border border-black/10 bg-[#f7f8f5] px-3 py-2">
                <div className="text-xs text-ink/55">{prospectingLaneLabel(lane as ProspectingLane)}</div>
                <div className="text-lg font-semibold">{count}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} className="rounded-md border border-black/10 bg-[#f7f8f5] px-3 py-2">
              <div className="text-xs text-ink/55">{leadTypeLabel(type)}</div>
              <div className="text-lg font-semibold">{count}</div>
            </div>
          ))}
        </div>
        {params.notice ? (
          <div className="mt-4 rounded-md border border-pine/20 bg-mint px-4 py-3 text-sm font-medium text-pine">
            {params.notice}
          </div>
        ) : null}
      </header>

      <div className="grid min-h-[calc(100vh-89px)] grid-cols-1 xl:grid-cols-[minmax(680px,1fr)_420px]">
        <section className="border-r border-black/10 px-5 py-5 md:px-8">
          <form className="grid gap-3 border-b border-black/10 pb-4 md:grid-cols-[1fr_150px_210px_180px_auto]">
            <label className="flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-3">
              <Search className="h-4 w-4 text-ink/45" />
              <input className="w-full bg-transparent text-sm outline-none" defaultValue={params.q ?? ""} name="q" placeholder="Buscar username, bio, palavra-chave" />
            </label>
            <select className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={params.minScore ?? ""} name="minScore">
              <option value="">Score mínimo</option>
              <option value="20">20+</option>
              <option value="35">35+</option>
              <option value="50">50+</option>
              <option value="70">70+</option>
            </select>
            <select className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={params.lane ?? "all"} name="lane">
              <option value="all">Todas as linhas</option>
              <option value="training">Treinamento</option>
              <option value="credentialing">Credenciamento</option>
              <option value="equipment">Equipamentos</option>
              <option value="partnership">Parceria/divulgação</option>
              <option value="review">Revisão</option>
            </select>
            <select className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={params.status ?? "all"} name="status">
              <option value="all">Todos os status</option>
              <option value="none">Novo</option>
              <option value="qualified">Qualificado</option>
              <option value="contacted">Abordagem/contato</option>
              <option value="approved_for_outreach">Aprovado</option>
              <option value="auto_outreach_qualified">Contato automático</option>
              <option value="outreach_prepared">Abordagem preparada</option>
              <option value="operator_confirmation_required">Aguardando confirmação</option>
              <option value="partnership_review">Parceria</option>
              <option value="nurture_later">Nutrir depois</option>
              <option value="closed">Encerrados</option>
              <option value="rejected">Descartado</option>
              <option value="do_not_contact">Não contatar</option>
            </select>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-pine px-4 text-sm font-medium text-white">
              <Filter className="h-4 w-4" />
              Filtrar
            </button>
          </form>

          <div className="mt-4 overflow-x-auto rounded-lg border border-black/10 bg-white shadow-panel">
            <div className="min-w-[1040px]">
              <div className="grid grid-cols-[minmax(230px,1.2fr)_145px_130px_95px_95px_120px_155px_130px] border-b border-black/10 bg-[#f1f2ee] px-4 py-3 text-xs font-semibold uppercase text-ink/55">
                <div>Lead</div>
                <div>Linha</div>
                <div>Tipo</div>
                <div>Score</div>
                <div>Valor</div>
                <div>Seguidores</div>
                <div>Prospectado</div>
                <div>Status</div>
              </div>
              <div className="divide-y divide-black/10">
                {rows.map(({ lead, lane }) => {
                  const isSelected = selected?.lead.id === lead.id;
                  return (
                    <a
                      className={`grid grid-cols-[minmax(230px,1.2fr)_145px_130px_95px_95px_120px_155px_130px] px-4 py-3 text-sm transition hover:bg-mint/45 ${isSelected ? "bg-mint/70" : ""}`}
                      href={`/leads?q=${params.q ?? ""}&minScore=${params.minScore ?? ""}&lane=${params.lane ?? "all"}&status=${params.status ?? "all"}&selected=${lead.id}`}
                      key={lead.id}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">@{lead.instagram_username}</div>
                        <div className="truncate text-xs text-ink/55">{lead.display_name ?? "Nome não identificado"}</div>
                        <div className="truncate text-xs text-ink/45">{lead.latest_discovery_keyword ?? lead.discovery_keyword ?? "sem busca"}</div>
                      </div>
                      <div className="flex items-center">
                        <span className="rounded-md bg-[#f1f2ee] px-2 py-1 text-xs font-medium">{prospectingLaneLabel(lane)}</span>
                      </div>
                      <div className="flex items-center text-xs font-medium text-ink/65">{leadTypeLabel(lead.lead_type)}</div>
                      <div>
                        <span className={`inline-flex min-w-12 justify-center rounded-md px-2 py-1 text-xs font-semibold ${scoreTone(lead.lead_score ?? 0)}`}>{lead.lead_score ?? 0}</span>
                      </div>
                      <div>
                        <span className={`inline-flex min-w-12 justify-center rounded-md px-2 py-1 text-xs font-semibold ${scoreTone(lead.commercial_value_score ?? 0)}`}>
                          {lead.commercial_value_score ?? 0}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-ink/70">{formatFollowers(lead.followers)}</div>
                      <div>
                        <div className="text-xs font-semibold text-ink/70">{freshnessLabel(lead)}</div>
                        <div className="mt-1 text-xs text-ink/45">{formatDate(lead.last_prospected_at ?? lead.discovered_at)}</div>
                      </div>
                      <div className="truncate text-xs text-ink/60">{statusLabel(lead.channel_state)}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="bg-white px-5 py-5 md:px-6">
          {selected ? (
            <div className="sticky top-0 space-y-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-ink/45">Lead selecionado</div>
                    <h2 className="mt-1 text-2xl font-semibold">@{selected.lead.instagram_username}</h2>
                    <p className="mt-1 text-sm text-ink/60">{selected.lead.display_name ?? "Nome não identificado"}</p>
                  </div>
                  <a
                    aria-label="Abrir perfil no Instagram"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 text-ink/65"
                    href={`https://www.instagram.com/${selected.lead.instagram_username}/`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className={`rounded-md p-3 ${scoreTone(selected.lead.lead_score ?? 0)}`}>
                    <div className="text-xs opacity-80">Lead Score</div>
                    <div className="text-2xl font-semibold">{selected.lead.lead_score ?? 0}</div>
                  </div>
                  <div className={`rounded-md p-3 ${scoreTone(selected.lead.commercial_value_score ?? 0)}`}>
                    <div className="text-xs opacity-80">Valor comercial</div>
                    <div className="text-2xl font-semibold">{selected.lead.commercial_value_score ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-black/10 bg-[#f7f8f5] p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4 text-pine" />
                  Diagnóstico
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Linha</span><strong>{prospectingLaneLabel(selected.lane)}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Tipo</span><strong>{selected.lead.lead_type ?? "unknown"}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Seguidores</span><strong>{formatFollowers(selected.lead.followers)}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Consciência</span><strong>{selected.lead.market_awareness ?? "unaware"}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Origem</span><strong>{selected.lead.latest_discovery_keyword ?? selected.lead.discovery_keyword ?? "sem keyword"}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Primeira vez</span><strong>{formatDate(selected.lead.discovered_at)}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Última prospecção</span><strong>{formatDate(selected.lead.last_prospected_at)}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Histórico</span><strong>{freshnessLabel(selected.lead)}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-ink/55">Status</span><strong>{statusLabel(selected.lead.channel_state)}</strong></div>
                </div>
              </div>

              <div className="rounded-lg border border-black/10 bg-white">
                <div className="border-b border-black/10 px-4 py-3 font-semibold">Bio capturada</div>
                <p className="max-h-40 overflow-auto px-4 py-3 text-sm leading-6 text-ink/70">{selected.lead.bio || "Sem bio capturada."}</p>
              </div>

              <div className="rounded-lg border border-black/10 bg-white">
                <div className="border-b border-black/10 px-4 py-3 font-semibold">Abordagens para parceria</div>
                <div className="space-y-3 px-4 py-3">
                  {selectedApproaches.map((approach, index) => (
                    <div className="rounded-md bg-[#f7f8f5] p-3 text-sm leading-6 text-ink/75" key={approach}>
                      <div className="mb-1 text-xs font-semibold uppercase text-ink/45">Exemplo {index + 1}</div>
                      {approach}
                    </div>
                  ))}
                  <ApprovalMessageForm lead={selected.lead} lane={selected.lane} message={selectedApproaches[0] ?? ""} returnTo={returnTo} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ReviewAction action="partnership" icon={Handshake} label="Parceria" lane={selected.lane} lead={selected.lead} returnTo={returnTo} tone="bg-sky text-white" />
                <ReviewAction action="nurture" icon={Clock3} label="Nutrir" lane={selected.lane} lead={selected.lead} returnTo={returnTo} tone="bg-[#f1f2ee] text-ink" />
                <ReviewAction action="reject" icon={Trash2} label="Descartar" lane={selected.lane} lead={selected.lead} returnTo={returnTo} tone="bg-[#f1f2ee] text-ink" />
                <div className="col-span-2">
                  <ReviewAction action="do_not_contact" icon={Ban} label="Não contatar" lane={selected.lane} lead={selected.lead} returnTo={returnTo} tone="bg-coral text-white" />
                </div>
              </div>

              <div className="rounded-lg border border-black/10 bg-white">
                <div className="border-b border-black/10 px-4 py-3 font-semibold">Pipeline e acompanhamento</div>
                <div className="divide-y divide-black/10">
                  {pipeline.length > 0 ? (
                    pipeline.map((item) => (
                      <div className="px-4 py-3" key={`${item.kind}-${item.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{item.title}</div>
                            <div className="mt-1 line-clamp-3 text-xs leading-5 text-ink/60">{item.detail}</div>
                          </div>
                          <span className="shrink-0 rounded-md bg-[#f1f2ee] px-2 py-1 text-xs font-medium text-ink/65">{item.status}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm leading-6 text-ink/60">
                      Nenhuma etapa registrada ainda. Ao aprovar uma abordagem, o CRM cria a conversa, salva a mensagem e agenda o acompanhamento.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-black/10 bg-[#f7f8f5] p-4 text-sm leading-6 text-ink/65">
                <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
                  <MessageSquareText className="h-4 w-4" />
                  Segurança operacional
                </div>
                Nenhuma ação desta tela envia DM. Ela registra decisão, estado e evento no CRM para formar uma fila revisada.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-black/10 bg-[#f7f8f5] p-6 text-sm text-ink/65">
              <AlertTriangle className="mb-3 h-5 w-5 text-coral" />
              Nenhum lead encontrado para revisar.
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
