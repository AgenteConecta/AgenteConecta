import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "@/lib/env";

describe("environment helpers", () => {
  it("normalizes Supabase REST URL to project root URL", () => {
    expect(normalizeSupabaseUrl("https://example.supabase.co/rest/v1/")).toBe("https://example.supabase.co");
    expect(normalizeSupabaseUrl("https://example.supabase.co")).toBe("https://example.supabase.co");
  });
});
