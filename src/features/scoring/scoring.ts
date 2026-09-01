import { loadBusinessConfig } from "@/lib/business-config";
import type {
  GeographyTier,
  LeadProfileInput,
  LeadScoreResult,
  LeadType,
  MarketAwareness,
  ProjectReadiness,
  ScoreContribution,
} from "@/lib/types";

const competitorTerms = ["control4", "crestron", "lutron", "savant", "knx", "rti", "elan"];
const businessTerms = ["empresa", "soluções", "projetos", "engenharia", "automação", "integrador"];
const beginnerTerms = ["estudante", "aprendendo", "iniciante", "curioso"];
const projectTerms = ["obra", "cliente pediu", "orçar", "projeto em andamento", "montar um painel"];

function normalizeText(input: LeadProfileInput): string {
  return [input.displayName, input.bio, input.category, input.city, input.state, input.website, ...(input.posts ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function add(contributions: ScoreContribution[], label: string, points: number): void {
  contributions.push({ label, points });
}

export function getGeographyTier(state?: string): GeographyTier {
  const config = loadBusinessConfig();
  const normalized = state?.trim().toUpperCase();
  if (normalized && config.priorityStates.includes(normalized)) {
    return "tier_1";
  }
  if (normalized && config.secondaryStates.includes(normalized)) {
    return "tier_2";
  }
  return "tier_3";
}

export function identifyLeadType(input: LeadProfileInput): LeadType {
  const text = normalizeText(input);
  if (hasAny(text, ["ltda", "cnpj", "empresa", "equipe", "soluções", "engenharia"])) {
    return "business";
  }
  if (hasAny(text, ["integrador", "eletricista", "instalador", "técnico", "cftv", "solar", "redes"])) {
    return "professional";
  }
  if (hasAny(text, beginnerTerms)) {
    return "learner";
  }
  return "unknown";
}

export function identifyMarketAwareness(input: LeadProfileInput): MarketAwareness {
  const text = normalizeText(input);
  if (hasAny(text, competitorTerms)) {
    return "competing_solution_user";
  }
  if (hasAny(text, ["integrador", "automação centralizada", "automação cabeada", "painel de automação"])) {
    return "professional_integrator";
  }
  if (hasAny(text, ["newtek", "fornecedor", "portfólio", "representação"])) {
    return "solution_aware";
  }
  if (hasAny(text, ["automação residencial", "casa inteligente", "smart home"])) {
    return "automation_aware";
  }
  if (hasAny(text, ["elétrica residencial", "instalações elétricas", "quadros elétricos"])) {
    return "problem_aware";
  }
  return "unaware";
}

export function identifyProjectReadiness(input: LeadProfileInput): ProjectReadiness {
  const text = normalizeText(input);
  if (hasAny(text, ["urgente", "preciso orçar", "cliente pediu"])) {
    return "urgent_project";
  }
  if (hasAny(text, projectTerms)) {
    return "active_project";
  }
  if (hasAny(text, ["planejamento", "em breve", "futuro"])) {
    return "planning";
  }
  return "unknown";
}

export function scoreLead(input: LeadProfileInput): LeadScoreResult {
  const config = loadBusinessConfig();
  const text = normalizeText(input);
  const leadType = identifyLeadType(input);
  const marketAwareness = identifyMarketAwareness(input);
  const geographyTier = getGeographyTier(input.state);
  const projectReadiness = identifyProjectReadiness(input);
  const scoreExplanation: ScoreContribution[] = [];
  const commercialExplanation: ScoreContribution[] = [];

  if (hasAny(text, ["automação residencial", "casa inteligente", "smart home"])) {
    add(scoreExplanation, "automação residencial", 20);
  }
  if (hasAny(text, ["automação cabeada", "automação centralizada", "painel de automação", "quadro de automação"])) {
    add(scoreExplanation, "automação cabeada ou centralizada", 20);
  }
  if (hasAny(text, ["integrador", "integrador residencial"])) {
    add(scoreExplanation, "integrador profissional", 15);
  }
  if (hasAny(text, ["empresa elétrica", "instalações elétricas", "engenharia elétrica"])) {
    add(scoreExplanation, "empresa ou atuação elétrica", 10);
  }
  if (hasAny(text, ["eletricista", "instalador", "técnico", "elétrica residencial"])) {
    add(scoreExplanation, "profissional de instalação elétrica", 25);
  }
  if (hasAny(text, competitorTerms)) {
    add(scoreExplanation, "trabalha ou menciona outra plataforma", 15);
  }
  if (hasAny(text, ["cnpj", "ltda", "empresa"])) {
    add(scoreExplanation, "empresa ou CNPJ aparente", 10);
  }
  if (hasAny(text, ["obra", "projeto", "instalação", "portfólio"])) {
    add(scoreExplanation, "publica obras ou projetos reais", 10);
  }
  if (hasAny(text, ["equipe", "time", "nossa equipe"])) {
    add(scoreExplanation, "possui equipe", 10);
  }
  if (geographyTier === "tier_1") {
    add(scoreExplanation, "estado prioritário", 10);
  }
  if (hasAny(text, ["alto padrão", "luxo", "premium"])) {
    add(scoreExplanation, "atua em alto padrão", 10);
  }
  if (hasAny(text, ["solar", "fotovoltaica", "cftv", "segurança eletrônica", "redes"])) {
    add(scoreExplanation, "segmento complementar", 5);
  }
  if (hasAny(text, beginnerTerms)) {
    add(scoreExplanation, "perfil iniciante ou curioso", -15);
  }
  if (hasAny(text, ["consumidor final", "minha casa", "apartamento"])) {
    add(scoreExplanation, "sinal de consumidor final", -40);
  }

  const rawLeadScore = scoreExplanation.reduce((total, item) => total + item.points, 0);
  const leadScore = Math.max(0, Math.min(100, rawLeadScore));

  if (leadType === "business") {
    add(commercialExplanation, "empresa estruturada", 25);
  }
  if (leadType === "professional") {
    add(commercialExplanation, "profissional que atende clientes", 15);
  }
  if (marketAwareness === "professional_integrator" || marketAwareness === "competing_solution_user") {
    add(commercialExplanation, "maturidade alta em automação", 25);
  }
  if (hasAny(text, ["equipe", "projetos", "obras", "alto padrão"])) {
    add(commercialExplanation, "capacidade comercial aparente", 20);
  }
  if (projectReadiness === "active_project" || projectReadiness === "urgent_project") {
    add(commercialExplanation, "projeto ou cliente imediato", 15);
  }
  add(commercialExplanation, `território ${geographyTier}`, config.territoryOpportunityDefaults[geographyTier] / 10);

  const commercialValueScore = Math.max(
    0,
    Math.min(100, Math.round(commercialExplanation.reduce((total, item) => total + item.points, 0))),
  );

  return {
    rawLeadScore,
    leadScore,
    commercialValueScore,
    leadType,
    marketAwareness,
    geographyTier,
    territoryOpportunityScore: config.territoryOpportunityDefaults[geographyTier],
    projectReadiness,
    businessType: leadType === "business" ? "company" : leadType,
    estimatedRole: leadType === "business" ? "owner_or_sales_contact" : leadType,
    scoreExplanation,
    commercialExplanation,
  };
}
