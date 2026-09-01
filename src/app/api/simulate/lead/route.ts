import { NextResponse } from "next/server";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { persistDiscoveredLead } from "@/features/leads/lead-repository";
import type { LeadProfileInput } from "@/lib/types";

export async function POST(request: Request) {
  const lead = (await request.json()) as LeadProfileInput;
  const persistence = await persistDiscoveredLead(lead);

  return NextResponse.json({
    lead,
    persistence,
    score: persistence.score,
    firstContactMessage: generateFirstContactMessage(lead, persistence.score),
    nextChannelState: "waiting_inbound_reply",
  });
}
