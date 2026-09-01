import type { LeadProfileInput, LeadScoreResult } from "@/lib/types";

const influencerTerms = [
  "curso",
  "mentoria",
  "aula",
  "professor",
  "conteúdo",
  "conteudo",
  "influencer",
  "youtube",
  "canal",
  "criador",
  "divulgação",
  "divulgacao",
];

const equipmentTerms = ["loja", "revenda", "distribuidor", "fornecedor", "produto", "equipamento", "kit"];

function normalize(input: LeadProfileInput): string {
  return [input.displayName, input.bio, input.category, input.website, ...(input.posts ?? [])]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type ProspectingLane = "training" | "credentialing" | "equipment" | "partnership" | "review";

export function identifyProspectingLane(lead: LeadProfileInput, score: LeadScoreResult): ProspectingLane {
  const text = normalize(lead);

  if (influencerTerms.some((term) => text.includes(term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()))) {
    return "partnership";
  }

  if (equipmentTerms.some((term) => text.includes(term))) {
    return "equipment";
  }

  if (score.leadType === "business" || score.commercialValueScore >= 55) {
    return "credentialing";
  }

  if (score.leadType === "learner" || score.leadScore >= 35) {
    return "training";
  }

  return "review";
}

export function prospectingLaneLabel(lane: ProspectingLane): string {
  const labels: Record<ProspectingLane, string> = {
    training: "Treinamento",
    credentialing: "Credenciamento",
    equipment: "Equipamentos",
    partnership: "Parceria/divulgação",
    review: "Revisão",
  };

  return labels[lane];
}
