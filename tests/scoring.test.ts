import { describe, expect, it } from "vitest";
import { scoreLead } from "@/features/scoring/scoring";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { renderCopyTemplate } from "@/features/conversations/copy-settings";

describe("lead scoring", () => {
  it("scores a structured integrator as high value", () => {
    const result = scoreLead({
      instagramUsername: "@automax",
      displayName: "Automax Integrações",
      bio: "Empresa de automação residencial em SP com projetos alto padrão, equipe e Control4.",
      state: "SP",
      posts: ["Painel de automação centralizada em obra real"],
    });

    expect(result.leadType).toBe("business");
    expect(result.marketAwareness).toBe("competing_solution_user");
    expect(result.leadScore).toBeGreaterThanOrEqual(90);
    expect(result.commercialValueScore).toBeGreaterThanOrEqual(80);
    expect(result.geographyTier).toBe("tier_1");
  });

  it("keeps beginner commercial score below a mature integrator", () => {
    const beginner = scoreLead({
      instagramUsername: "@marcos_eletrica",
      displayName: "Marcos Eletricista",
      bio: "Eletricista residencial iniciante aprendendo automação residencial.",
      state: "GO",
    });

    expect(beginner.leadType).toBe("professional");
    expect(beginner.leadScore).toBeGreaterThan(beginner.commercialValueScore);
  });
});

describe("first contact", () => {
  it("does not include prices in the first message", () => {
    const lead = {
      instagramUsername: "@marcos_eletrica",
      displayName: "Marcos Freire",
      bio: "Eletricista residencial",
      state: "MT",
    };
    const message = generateFirstContactMessage(lead, scoreLead(lead));

    expect(message).not.toContain("164");
    expect(message).not.toContain("297");
    expect(message).toContain("automação residencial");
  });

  it("renders saved copy placeholders with profile names", async () => {
    const message = await renderCopyTemplate("Olá, {Nome}! Vi o perfil {canal} e quero falar com {username}.", {
      instagramUsername: "@centro_oeste_manutencoes",
      displayName: "Centro Oeste Manutenções Residenciais",
    });

    expect(message).toBe("Olá, Centro! Vi o perfil Centro Oeste Manutenções Residenciais e quero falar com @centro_oeste_manutencoes.");
  });
});
