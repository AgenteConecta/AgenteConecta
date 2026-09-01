import { describe, expect, it } from "vitest";
import { detectsOptOut } from "@/features/conversations/opt-out";
import { assignVariant } from "@/features/experiments/assignment";
import { canRunJob, markJobFailure } from "@/features/jobs/job-queue";
import { canSendAutomation, shouldPauseAutomation } from "@/features/safety/circuit-breaker";
import { assertInstagramUrl } from "@/integrations/instagram/browser-worker";
import { extractEvolutionInbound } from "@/integrations/evolution/webhook";

describe("safety controls", () => {
  it("detects opt out and blocks automation", () => {
    expect(detectsOptOut("Pode parar, não quero mensagens.")).toBe(true);
    expect(
      canSendAutomation({
        masterPause: false,
        doNotContact: true,
        channelLockedByOtherOwner: false,
        budgetExceeded: false,
        circuitBreakerOpen: false,
      }),
    ).toBe(false);
  });

  it("opens circuit breaker for critical signals and master pause blocks sending", () => {
    expect(shouldPauseAutomation({ webhookDown: true })).toBe(true);
    expect(
      canSendAutomation({
        masterPause: true,
        doNotContact: false,
        channelLockedByOtherOwner: false,
        budgetExceeded: false,
        circuitBreakerOpen: false,
      }),
    ).toBe(false);
  });

  it("allows only Instagram URLs in browser worker", () => {
    expect(() => assertInstagramUrl("https://www.instagram.com/newtekatm/")).not.toThrow();
    expect(() => assertInstagramUrl("https://example.com")).toThrow();
  });
});

describe("jobs and experiments", () => {
  it("retries jobs and moves to dead letter after max attempts", () => {
    const failed = markJobFailure({
      id: "job_1",
      type: "send_instagram_dm",
      idempotencyKey: "dm-lead-1",
      attempts: 2,
      maxAttempts: 3,
      lockedUntil: null,
      status: "queued",
    });

    expect(failed.status).toBe("dead");
    expect(canRunJob(failed)).toBe(false);
  });

  it("assigns experiments deterministically", () => {
    const variants = [
      { id: "A", weight: 50 },
      { id: "B", weight: 50 },
    ];
    expect(assignVariant("lead_123", variants)).toEqual(assignVariant("lead_123", variants));
  });
});

describe("handoffs", () => {
  it("extracts Evolution inbound message for same-lead mapping", () => {
    const inbound = extractEvolutionInbound({
      event: "messages.upsert",
      instance: "newtek",
      data: {
        key: {
          id: "msg_1",
          remoteJid: "5562998449724@s.whatsapp.net",
          fromMe: false,
        },
        message: {
          conversation: "Quero continuar no WhatsApp",
        },
        pushName: "Carlos",
      },
    });

    expect(inbound.phone).toBe("5562998449724");
    expect(inbound.text).toContain("WhatsApp");
  });
});
