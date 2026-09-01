import { NextResponse } from "next/server";
import { detectsOptOut } from "@/features/conversations/opt-out";
import { extractEvolutionInbound, type EvolutionWebhookPayload } from "@/integrations/evolution/webhook";

export async function POST(request: Request) {
  const payload = (await request.json()) as EvolutionWebhookPayload;
  const inbound = extractEvolutionInbound(payload);

  return NextResponse.json({
    accepted: true,
    channel: "whatsapp",
    inbound,
    intent: detectsOptOut(inbound.text) ? "opt_out" : "ambiguous",
    sameLeadMappingKey: inbound.phone,
  });
}
