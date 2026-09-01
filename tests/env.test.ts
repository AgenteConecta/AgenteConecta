import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, normalizeSupabaseUrl } from "@/lib/env";
import { encodeEvolutionInstance } from "@/integrations/evolution/evolution-client";

describe("environment helpers", () => {
  it("normalizes Supabase REST URL to project root URL", () => {
    expect(normalizeSupabaseUrl("https://example.supabase.co/rest/v1/")).toBe("https://example.supabase.co");
    expect(normalizeSupabaseUrl("https://example.supabase.co")).toBe("https://example.supabase.co");
  });

  it("normalizes external base URLs and encodes Evolution instances", () => {
    expect(normalizeBaseUrl("http://127.0.0.1:8080/")).toBe("http://127.0.0.1:8080");
    expect(encodeEvolutionInstance("Newtek Automação")).toBe("Newtek%20Automa%C3%A7%C3%A3o");
  });
});
