import { describe, expect, it } from "vitest";
import { findDuplicateLead } from "@/features/leads/dedupe";

describe("lead dedupe", () => {
  it("finds duplicates by username without @ sensitivity", () => {
    const duplicate = findDuplicateLead(
      { instagramUsername: "@newlead" },
      [{ id: "lead_1", instagramUsername: "newlead" }],
    );

    expect(duplicate?.id).toBe("lead_1");
  });

  it("finds duplicates by company or contact fields", () => {
    const duplicate = findDuplicateLead(
      { phone: "5562998449724", companyName: "Automax Integrações" },
      [{ id: "lead_2", phone: "5562998449724", companyName: "Outra Empresa" }],
    );

    expect(duplicate?.id).toBe("lead_2");
  });
});
