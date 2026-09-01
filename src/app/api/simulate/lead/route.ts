import { NextResponse } from "next/server";
import { generateFirstContactMessage } from "@/features/conversations/first-contact";
import { scoreLead } from "@/features/scoring/scoring";
import type { LeadProfileInput } from "@/lib/types";

export async function POST(request: Request) {
  const lead = (await request.json()) as LeadProfileInput;
  const score = scoreLead(lead);

  return NextResponse.json({
    lead,
    score,
    firstContactMessage: generateFirstContactMessage(lead, score),
    nextChannelState: "waiting_inbound_reply",
  });
}
