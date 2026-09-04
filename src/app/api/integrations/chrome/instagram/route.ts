import { NextResponse } from "next/server";
import { getChromeInstagramStatus, openInstagramInConnectedChrome } from "@/integrations/instagram/chrome-control";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await openInstagramInConnectedChrome();

    return NextResponse.json({
      ok: true,
      ...result,
      status: await getChromeInstagramStatus(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível abrir o Instagram.",
      },
      { status: 500 },
    );
  }
}
