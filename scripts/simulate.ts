async function loadLocalEnv() {
  const mod = await import("@next/env");
  const loader = mod.loadEnvConfig ?? mod.default?.loadEnvConfig;
  loader(process.cwd());
}

async function main() {
  await loadLocalEnv();
  const { generateFirstContactMessage } = await import("@/features/conversations/first-contact");
  const { scoreLead } = await import("@/features/scoring/scoring");

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
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export {};
