import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as unknown;
  return NextResponse.json({
    accepted: true,
    channel: "meta_api",
    payloadReceived: Boolean(payload),
    handoff: "browser_to_meta_api_when_inbound_reply_is_supported",
  });
}
