export type ProspectingAudienceId = "auto" | "architects" | "electricians" | "electrical_influencers" | "integrators" | "equipment" | string;

export type ProspectingAudience = {
  id: ProspectingAudienceId;
  label: string;
  description: string;
  keywords: string[];
};

export const prospectingAudiences: ProspectingAudience[] = [
  {
    id: "auto",
    label: "Automático recomendado",
    description: "Mistura arquitetos, elétrica, automação e perfis com potencial de parceria.",
    keywords: ["automação residencial", "casa inteligente", "automação cabeada", "arquitetura residencial", "elétrica residencial"],
  },
  {
    id: "architects",
    label: "Arquitetos",
    description: "Perfis de arquitetura, interiores e obras residenciais de médio/alto padrão.",
    keywords: ["arquitetura residencial", "arquitetura de interiores", "obra residencial", "casa alto padrão", "projeto residencial"],
  },
  {
    id: "electricians",
    label: "Eletricistas",
    description: "Profissionais de elétrica residencial que podem instalar ou indicar automação cabeada.",
    keywords: ["eletricista residencial", "elétrica residencial", "instalação elétrica", "quadro elétrico", "infraestrutura elétrica"],
  },
  {
    id: "electrical_influencers",
    label: "Influencers de elétrica",
    description: "Criadores, professores e canais com público técnico para parceria ou divulgação.",
    keywords: ["curso de elétrica", "dicas de elétrica", "professor de elétrica", "eletricista influencer", "canal de elétrica"],
  },
  {
    id: "integrators",
    label: "Integradores de automação",
    description: "Empresas e profissionais que já vendem automação e podem avaliar portfólio Newtek.",
    keywords: ["integrador de automação", "automação residencial", "automação centralizada", "casa inteligente", "projetos de automação"],
  },
  {
    id: "equipment",
    label: "Lojas e revendas",
    description: "Lojas, fornecedores e revendedores que podem trabalhar com produto ou kit.",
    keywords: ["loja de elétrica", "material elétrico", "revenda elétrica", "fornecedor elétrico", "equipamentos automação"],
  },
];

export function getProspectingAudience(id: string | null | undefined): ProspectingAudience {
  return prospectingAudiences.find((audience) => audience.id === id) ?? prospectingAudiences[0];
}

export function parseCustomKeywords(input: string): string[] {
  return input
    .split(/[\n,;]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 12);
}
