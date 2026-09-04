import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone } from "@/features/outreach/whatsapp-actions";

describe("whatsapp actions", () => {
  it("normalizes Brazilian WhatsApp numbers for Evolution", () => {
    expect(normalizeWhatsAppPhone("(62) 99844-9724")).toBe("5562998449724");
    expect(normalizeWhatsAppPhone("+55 62 99844-9724")).toBe("5562998449724");
    expect(normalizeWhatsAppPhone("62998449724")).toBe("5562998449724");
  });
});
