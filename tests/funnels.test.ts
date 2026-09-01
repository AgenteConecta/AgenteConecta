import { describe, expect, it } from "vitest";
import { moveCredentialingStage, moveTrainingStage } from "@/features/funnels/funnels";

describe("funnels", () => {
  it("advances training funnel but does not move backwards automatically", () => {
    expect(moveTrainingStage("contacted", "student")).toBe("student");
    expect(moveTrainingStage("student", "qualified")).toBe("student");
  });

  it("advances credentialing through certification and reseller stages", () => {
    expect(moveCredentialingStage("certification_pending", "credentialed")).toBe("credentialed");
    expect(moveCredentialingStage("active_reseller", "cnpj_pending")).toBe("active_reseller");
  });
});
