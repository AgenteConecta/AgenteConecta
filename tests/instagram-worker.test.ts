import { describe, expect, it } from "vitest";
import { hashtagUrl, parseInstagramFollowerCount } from "@/integrations/instagram/browser-worker";

describe("instagram worker", () => {
  it("builds safe hashtag URLs from Portuguese keywords", () => {
    expect(hashtagUrl("automação residencial")).toBe("https://www.instagram.com/explore/tags/automacaoresidencial/");
    expect(hashtagUrl("KNX")).toBe("https://www.instagram.com/explore/tags/knx/");
  });

  it("parses follower counts from Instagram profile text", () => {
    expect(parseInstagramFollowerCount("250K followers")).toBe(250000);
    expect(parseInstagramFollowerCount("12,5K seguidores")).toBe(12500);
    expect(parseInstagramFollowerCount("1.2M followers")).toBe(1200000);
  });
});
