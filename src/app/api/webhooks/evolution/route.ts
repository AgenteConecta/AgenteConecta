import { NextResponse } from "next/server";
import { detectsOptOut } from "@/features/conversations/opt-out";
import { recordEvolutionInboundMessage } from "@/features/outreach/whatsapp-actions";
import { extractEvolutionInbound, type EvolutionWebhookPayload } from "@/integrations/evolution/webhook";

export async function POST(request: Request) {
  const payload = (await request.json()) as EvolutionWebhookPayload;
  const inbound = extractEvolutionInbound(payload);
  const stored =
    inbound.phone && inbound.text && !inbound.fromMe
      ? await recordEvolutionInboundMessage({
          phone: inbound.phone,
          displayName: inbound.displayName,
          text: inbound.text,
          providerMessageId: inbound.providerMessageId,
        })
      : null;

  return NextResponse.json({
    accepted: true,
    channel: "whatsapp",
    inbound,
    intent: detectsOptOut(inbound.text) ? "opt_out" : "ambiguous",
    sameLeadMappingKey: inbound.phone,
    stored,
  });
}
