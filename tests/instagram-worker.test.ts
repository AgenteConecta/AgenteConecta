import { describe, expect, it } from "vitest";
import { hashtagUrl } from "@/integrations/instagram/browser-worker";

describe("instagram worker", () => {
  it("builds safe hashtag URLs from Portuguese keywords", () => {
    expect(hashtagUrl("automação residencial")).toBe("https://www.instagram.com/explore/tags/automacaoresidencial/");
    expect(hashtagUrl("KNX")).toBe("https://www.instagram.com/explore/tags/knx/");
  });
});
