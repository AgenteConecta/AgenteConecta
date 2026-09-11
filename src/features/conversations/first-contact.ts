import type { LeadProfileInput, LeadScoreResult } from "@/lib/types";
import { getCopyTemplates, renderCopyTemplate } from "@/features/conversations/copy-settings";

export function generateFirstContactMessage(lead: LeadProfileInput, score: LeadScoreResult): string {
  return generateFirstContactVariants(lead, score)[0];
}

export async function generateFirstContactMessageWithSavedCopy(lead: LeadProfileInput, score: LeadScoreResult): Promise<string> {
  return (await generateFirstContactVariantsWithSavedCopy(lead, score))[0];
}

export async function generateFirstContactVariantsWithSavedCopy(lead: LeadProfileInput, score: LeadScoreResult): Promise<string[]> {
  const templates = await getCopyTemplates();
  const savedTemplates = [
    isElectricianLead(lead, score) ? templates.electricians : "",
    templates.all,
  ].filter(Boolean);
  const savedVariants = await Promise.all(savedTemplates.map((template) => renderCopyTemplate(template, lead)));

  return [...savedVariants, ...generateFirstContactVariants(lead, score)];
}

export function generateFirstContactVariants(lead: LeadProfileInput, score: LeadScoreResult): string[] {
  const name = lead.displayName?.split(" ")[0] || lead.instagramUsername.replace("@", "");
  const cityPart = lead.city && lead.state ? ` em ${lead.city}/${lead.state}` : "";
  const profileContext =
    score.commercialValueScore >= 70 || score.leadType === "business"
      ? "Vi seu perfil, gostei bastante da forma como você se comunica com seu público e acredito que existe alinhamento com o mercado que a Newtek atende."
      : "Vi seu perfil e gostei da sua relação com projetos residenciais e tecnologia aplicada em obras.";

  const partnershipMessage = `Olá, ${name}. ${profileContext} Você já conhece automação residencial cabeada? Gostaria de apresentar a solução da Newtek, porque vejo potencial para uma parceria bem interessante entre produto, autoridade técnica e o público que acompanha seu trabalho.`;

  const authorityMessage = `Olá, ${name}. Acompanhei seu perfil e achei forte a conexão com o público de arquitetura, elétrica e casas inteligentes. A Newtek trabalha com automação residencial cabeada, uma solução pensada para projetos mais robustos. Posso te apresentar rapidamente para avaliarmos uma possível parceria?`;

  const productMessage = `Olá, ${name}. Vi que seu conteúdo conversa com pessoas que se interessam por tecnologia, conforto e projetos residenciais de qualidade. Quero te apresentar a automação cabeada da Newtek; acredito que pode gerar uma divulgação com bastante valor para seu público e uma parceria vantajosa para ambos.`;

  if (score.marketAwareness === "competing_solution_user") {
    return [
      `Olá, ${name}. Vi alguns projetos de automação de vocês${cityPart} e percebi que já atuam com soluções profissionais. A Newtek trabalha com automação residencial cabeada e gostaria de apresentar nosso produto para avaliarmos aderência em projetos ou uma possível parceria comercial.`,
      authorityMessage,
      productMessage,
    ];
  }

  if (score.marketAwareness === "professional_integrator" || score.leadType === "business") {
    return [
      `Olá, ${name}. Vi que vocês trabalham com automação residencial${cityPart}. A Newtek tem uma solução cabeada para projetos residenciais e gostaria de apresentar o produto para entender se faz sentido como portfólio, parceria ou indicação para seus clientes.`,
      authorityMessage,
      productMessage,
    ];
  }

  if (score.leadType === "professional") {
    return [
      `Olá, ${name}. Vi que você trabalha com elétrica residencial. Muitos eletricistas fazem toda a estrutura da obra, mas depois outra empresa entra para vender automação residencial, Alexa, cortinas e controle pelo app. A Newtek ajuda o eletricista a assumir também essa parte da obra. Posso te mostrar como funciona?`,
      `Olá, ${name}. Vi que você trabalha com elétrica. Você sabia que pode usar os mesmos clientes e obras que já atende para começar a oferecer automação residencial e aumentar o valor dos seus projetos? A Newtek criou uma estrutura prática para ajudar profissionais de elétrica a entrar nesse mercado. Posso te mostrar rapidamente como funciona?`,
      `Olá, ${name}. Vi que você trabalha na área elétrica. A Newtek criou uma plataforma para ajudar eletricistas a vender automação residencial de alto padrão, com treinamento, projetos, simulador, propostas, conteúdo com IA e suporte técnico. Posso te mostrar como funciona?`,
      authorityMessage,
      productMessage,
    ];
  }

  return [partnershipMessage, authorityMessage, productMessage];
}

function isElectricianLead(lead: LeadProfileInput, score: LeadScoreResult) {
  const text = [lead.displayName, lead.bio, lead.category, lead.website, lead.discoveryKeyword, ...(lead.posts ?? [])]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return score.leadType === "professional" || text.includes("eletric");
}
