import { describe, expect, it } from "vitest";
import { hasAudienceIcpSignal, hasMinimumIcpSignal } from "@/features/prospecting/icp-filter";

describe("ICP prospecting filter", () => {
  it("keeps profiles with automation and complementary segment signals", () => {
    expect(
      hasMinimumIcpSignal({
        instagramUsername: "@empresa_smart",
        bio: "Projetos de automação residencial e CFTV",
      }),
    ).toBe(true);
  });

  it("filters unrelated profiles before persistence", () => {
    expect(
      hasMinimumIcpSignal({
        instagramUsername: "@perfil_aleatorio",
        bio: "Moda, viagens e lifestyle",
      }),
    ).toBe(false);
  });

  it("does not use the searched keyword as proof of fit", () => {
    expect(
      hasAudienceIcpSignal(
        {
          instagramUsername: "@blog",
          displayName: "Blog",
          bio: "Docs",
          discoveryKeyword: "automação residencial",
        },
        "auto",
      ),
    ).toBe(false);
  });

  it("requires signals from the configured audience", () => {
    expect(
      hasAudienceIcpSignal(
        {
          instagramUsername: "@studio_arq",
          displayName: "Studio de Arquitetura",
          bio: "Projetos residenciais e interiores",
        },
        "electricians",
      ),
    ).toBe(false);
  });

  it("blocks medical profiles captured during electrician searches", () => {
    expect(
      hasAudienceIcpSignal(
        {
          instagramUsername: "@pedrolhermusieau",
          displayName: "Pedro Lhermusieau",
          bio: "Médico Radiologia Neurorradio",
          discoveryKeyword: "automação residencial eletricista",
        },
        "electricians",
      ),
    ).toBe(false);
  });
});
