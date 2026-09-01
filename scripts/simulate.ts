import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { scoreLead } from "@/features/scoring/scoring";

const lead = {
  instagramUsername: "@automax_integracoes",
  displayName: "Automax Integrações",
  bio: "Empresa de automação residencial em São Paulo com projetos alto padrão, equipe e Control4.",
  city: "São Paulo",
  state: "SP",
  posts: ["Painel de automação centralizada", "Projeto em andamento para cliente residencial"],
};

const score = scoreLead(lead);

console.log(
  JSON.stringify(
    {
      lead,
      score,
      firstContact: generateFirstContactMessage(lead, score),
      channelStateAfterDm: "waiting_inbound_reply",
    },
    null,
    2,
  ),
);
