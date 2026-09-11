import { scoreLead } from "@/features/scoring/scoring";
import type { LeadProfileInput } from "@/lib/types";

const audienceTerms: Record<string, string[]> = {
  auto: [
    "automação",
    "automacao",
    "casa inteligente",
    "smart home",
    "elétrica",
    "eletrica",
    "eletricista",
    "integrador",
    "instalador",
    "arquitetura",
    "arquiteto",
    "engenharia elétrica",
    "engenharia eletrica",
  ],
  architects: ["arquitetura", "arquiteto", "interiores", "obra residencial", "projeto residencial", "alto padrão", "alto padrao", "construtora"],
  electricians: ["elétrica", "eletrica", "eletricista", "instalação elétrica", "instalacao eletrica", "quadro elétrico", "quadro eletrico", "engenharia elétrica", "engenharia eletrica"],
  electrical_influencers: ["elétrica", "eletrica", "eletricista", "professor de elétrica", "professor de eletrica", "curso de elétrica", "curso de eletrica", "dicas de elétrica", "dicas de eletrica"],
  integrators: ["automação", "automacao", "integrador", "casa inteligente", "smart home", "automação residencial", "automacao residencial", "automação centralizada", "automacao centralizada", "knx", "control4", "crestron", "lutron"],
  equipment: ["loja de elétrica", "loja de eletrica", "material elétrico", "material eletrico", "revenda", "distribuidora", "fornecedor", "equipamentos", "automação", "automacao"],
};

const unrelatedTerms = [
  "blog pessoal",
  "moda",
  "beleza",
  "maquiagem",
  "receitas",
  "viagem",
  "meme",
  "humor",
  "fitness",
  "academia",
  "jogo",
  "games",
  "notícia",
  "noticia",
  "médico",
  "medico",
  "médica",
  "medica",
  "medicina",
  "radiologia",
  "neurorradio",
  "neuroradio",
  "hospital",
  "clínica",
  "clinica",
  "odontologia",
  "dentista",
  "advogado",
  "advocacia",
];

const adultOrEscortTerms = [
  "garota de programa",
  "garoto de programa",
  "acompanhante",
  "acompanhantes",
  "escort",
  "call girl",
  "onlyfans",
  "privacy",
  "conteudo adulto",
  "conteúdo adulto",
  "18+",
  "nudes",
  "nude",
  "pack",
  "packs",
  "programinha",
  "atendimento com local",
  "atendimento sem local",
  "sigilo total",
  "massagem sensual",
  "fetiche",
  "sugar baby",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function hasMinimumIcpSignal(lead: LeadProfileInput): boolean {
  return hasAudienceIcpSignal(lead, "auto");
}

export function hasDisqualifyingIcpSignal(lead: LeadProfileInput): boolean {
  const text = normalize([lead.instagramUsername, lead.displayName, lead.bio, lead.category, lead.website, ...(lead.posts ?? [])].filter(Boolean).join(" "));

  if (!text.trim()) {
    return false;
  }

  return [...unrelatedTerms, ...adultOrEscortTerms].some((term) => text.includes(normalize(term)));
}

export function hasAudienceIcpSignal(lead: LeadProfileInput, audienceId: string): boolean {
  const text = normalize([lead.displayName, lead.bio, lead.category, lead.website, ...(lead.posts ?? [])].filter(Boolean).join(" "));

  if (!text.trim() || hasDisqualifyingIcpSignal(lead)) {
    return false;
  }

  const terms = audienceTerms[audienceId] ?? audienceTerms.auto;
  const score = scoreLead(lead);
  const hasConfiguredAudienceTerm = terms.some((term) => text.includes(normalize(term)));

  if (audienceId !== "auto") {
    return hasConfiguredAudienceTerm;
  }

  return hasConfiguredAudienceTerm || score.leadScore >= 35;
}
