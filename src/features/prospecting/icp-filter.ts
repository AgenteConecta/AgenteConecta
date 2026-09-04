import { scoreLead } from "@/features/scoring/scoring";
import type { LeadProfileInput } from "@/lib/types";

const minimumIcpTerms = [
  "automação",
  "automacao",
  "elétrica",
  "eletrica",
  "eletricista",
  "integrador",
  "instalador",
  "cftv",
  "alarme",
  "segurança eletrônica",
  "seguranca eletronica",
  "solar",
  "fotovoltaica",
  "redes",
  "infraestrutura",
  "engenharia",
  "engenheiro",
  "arquitetura",
  "arquiteto",
  "construtora",
  "home theater",
  "áudio e vídeo",
  "audio e video",
  "smart home",
  "casa inteligente",
  "knx",
  "control4",
  "crestron",
  "lutron",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function hasMinimumIcpSignal(lead: LeadProfileInput): boolean {
  const text = normalize([lead.displayName, lead.bio, lead.category, lead.website, lead.discoveryKeyword, lead.discoverySource, ...(lead.posts ?? [])].filter(Boolean).join(" "));
  const score = scoreLead(lead);

  return minimumIcpTerms.some((term) => text.includes(normalize(term))) || score.leadScore >= 20 || score.commercialValueScore >= 20;
}
