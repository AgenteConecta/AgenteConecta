import { CheckCircle2, Filter, Search, Send, UserRoundSearch } from "lucide-react";
import { approveLeadForOutreach, listLeadsForReview } from "@/features/leads/review-repository";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { scoreLead } from "@/features/scoring/scoring";
import { identifyProspectingLane, prospectingLaneLabel, type ProspectingLane } from "@/features/prospecting/prospecting-lane";
import { AppShell } from "@/components/app-shell";

type SearchParams = Promise<{
  q?: string;
  minScore?: string;
  lane?: string;
}>;

function scoreTone(score: number) {
  if (score >= 70) {
    return "bg-mint text-pine";
  }
  if (score >= 35) {
    return "bg-[#fff4d9] text-ink";
  }
  return "bg-[#f1f2ee] text-ink/70";
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const leads = await listLeadsForReview({
    q: params.q,
    minScore: params.minScore ? Number(params.minScore) : undefined,
  });

  const enriched = leads
    .map((lead) => {
      const input = {
        instagramUsername: `@${lead.instagram_username ?? ""}`,
        displayName: lead.display_name ?? lead.instagram_username ?? "Lead",
        bio: lead.bio ?? "",
        city: lead.city ?? undefined,
        state: lead.state ?? undefined,
        discoveryKeyword: lead.discovery_keyword ?? undefined,
      };
      const computedScore = scoreLead(input);
      const lane = identifyProspectingLane(input, {
        ...computedScore,
        leadScore: lead.lead_score ?? computedScore.leadScore,
        commercialValueScore: lead.commercial_value_score ?? computedScore.commercialValueScore,
        leadType:
          lead.lead_type === "learner" || lead.lead_type === "professional" || lead.lead_type === "business"
            ? lead.lead_type
            : computedScore.leadType,
      });

      return {
        lead,
        input,
        lane,
        firstMessage: generateFirstContactMessage(input, computedScore),
      };
    })
    .filter((item) => !params.lane || params.lane === "all" || item.lane === params.lane);

  return (
    <AppShell active="Leads">
      <header className="border-b border-black/10 bg-white px-5 py-4 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-pine">Revisão comercial</p>
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Leads reais</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-medium text-pine">
            <UserRoundSearch className="h-4 w-4" />
            {enriched.length} em revisão
          </div>
        </div>
      </header>

      <div className="space-y-5 px-5 py-6 md:px-8">
        <form className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-panel md:grid-cols-[1fr_170px_220px_auto]">
          <label className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-2">
            <Search className="h-4 w-4 text-ink/50" />
            <input className="w-full bg-transparent text-sm outline-none" defaultValue={params.q ?? ""} name="q" placeholder="Buscar por Instagram, nome, bio ou palavra-chave" />
          </label>
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm" defaultValue={params.minScore ?? ""} name="minScore">
            <option value="">Score mínimo</option>
            <option value="20">20+</option>
            <option value="35">35+</option>
            <option value="50">50+</option>
            <option value="70">70+</option>
          </select>
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm" defaultValue={params.lane ?? "all"} name="lane">
            <option value="all">Todas as linhas</option>
            <option value="training">Treinamento</option>
            <option value="credentialing">Credenciamento</option>
            <option value="equipment">Equipamentos</option>
            <option value="partnership">Parceria/divulgação</option>
            <option value="review">Revisão</option>
          </select>
          <button className="inline-flex items-center justify-center gap-2 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white">
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
        </form>

        <section className="grid gap-3">
          {enriched.map(({ lead, input, lane, firstMessage }) => {
            const leadScore = lead.lead_score ?? 0;
            const commercialScore = lead.commercial_value_score ?? 0;
            return (
              <article key={lead.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">
                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a className="text-lg font-semibold text-pine hover:underline" href={`https://www.instagram.com/${lead.instagram_username}/`} rel="noreferrer" target="_blank">
                        @{lead.instagram_username}
                      </a>
                      <span className="rounded-md bg-[#f1f2ee] px-2 py-1 text-xs font-medium text-ink/70">{prospectingLaneLabel(lane as ProspectingLane)}</span>
                      <span className="rounded-md bg-[#f1f2ee] px-2 py-1 text-xs font-medium text-ink/70">{lead.discovery_keyword ?? "sem keyword"}</span>
                    </div>
                    <div className="mt-1 text-sm text-ink/65">
                      {lead.display_name ?? "Nome não identificado"} · {lead.city ?? "Cidade não identificada"}/{lead.state ?? "UF"} · {lead.lead_type ?? "unknown"} ·{" "}
                      {lead.market_awareness ?? "unaware"}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/75">{lead.bio || "Bio ainda não capturada."}</p>
                    <div className="mt-3 rounded-md bg-[#f7f8f5] p-3 text-sm leading-6">
                      <span className="font-medium text-ink/70">Mensagem sugerida: </span>
                      {lane === "partnership"
                        ? `Olá, ${input.displayName.split(" ")[0]}. Vi que você produz conteúdo ou atua como referência em automação. Faz sentido conversarmos sobre conhecer a solução Newtek para uma possível parceria ou divulgação?`
                        : firstMessage}
                    </div>
                  </div>

                  <div className="grid content-between gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-md p-3 ${scoreTone(leadScore)}`}>
                        <div className="text-xs">Lead Score</div>
                        <div className="text-2xl font-semibold">{leadScore}</div>
                      </div>
                      <div className={`rounded-md p-3 ${scoreTone(commercialScore)}`}>
                        <div className="text-xs">Valor comercial</div>
                        <div className="text-2xl font-semibold">{commercialScore}</div>
                      </div>
                    </div>
                    <form action={approveLeadForOutreach}>
                      <input name="leadId" type="hidden" value={lead.id} />
                      <input name="lane" type="hidden" value={lane} />
                      <input name="username" type="hidden" value={`@${lead.instagram_username ?? ""}`} />
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-pine px-3 py-2 text-sm font-medium text-white">
                        <CheckCircle2 className="h-4 w-4" />
                        Aprovar abordagem
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}

          {enriched.length === 0 ? (
            <div className="rounded-lg border border-black/10 bg-white p-8 text-center text-sm text-ink/65 shadow-panel">
              Nenhum lead encontrado com esses filtros.
            </div>
          ) : null}
        </section>

        <div className="rounded-lg border border-black/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-panel">
          <div className="mb-1 flex items-center gap-2 font-medium text-ink">
            <Send className="h-4 w-4" />
            Controle de envio
          </div>
          Aprovar abordagem apenas registra o lead para revisão operacional. O sistema continua em dry-run e nenhuma DM é enviada automaticamente.
        </div>
      </div>
    </AppShell>
  );
}
