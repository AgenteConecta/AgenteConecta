import { describe, expect, it } from "vitest";
import { hasMinimumIcpSignal } from "@/features/prospecting/icp-filter";

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
});
