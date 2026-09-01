import type { LeadProfileInput, LeadScoreResult } from "@/lib/types";

export function generateFirstContactMessage(lead: LeadProfileInput, score: LeadScoreResult): string {
  const name = lead.displayName?.split(" ")[0] || lead.instagramUsername.replace("@", "");
  const cityPart = lead.city && lead.state ? ` em ${lead.city}/${lead.state}` : "";

  if (score.marketAwareness === "competing_solution_user") {
    return `Olá, ${name}. Vi alguns projetos de automação de vocês${cityPart} e percebi que já atuam profissionalmente no segmento. Vocês costumam avaliar novas soluções para projetos específicos?`;
  }

  if (score.marketAwareness === "professional_integrator" || score.leadType === "business") {
    return `Olá, ${name}. Vi que vocês trabalham com automação residencial${cityPart}. Vocês costumam trabalhar com uma solução principal ou avaliam novas marcas para ampliar o portfólio?`;
  }

  if (score.leadType === "professional") {
    return `Olá, ${name}. Vi alguns trabalhos de elétrica residencial no seu perfil. Você já trabalha também com automação residencial ou ainda não entrou nessa área?`;
  }

  return `Olá, ${name}. Vi seu perfil e sua relação com elétrica residencial. Você já teve contato com automação residencial em alguma obra?`;
}
