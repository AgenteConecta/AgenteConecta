import { NextResponse } from "next/server";
import { getChromeInstagramStatus, launchChromeForInstagram } from "@/integrations/instagram/chrome-control";

export const runtime = "nodejs";

export async function POST() {
  try {
    const launch = await launchChromeForInstagram();

    return NextResponse.json({
      ok: true,
      message: "Chrome aberto para conexão. Faça login no Instagram nessa janela.",
      chromeCdpUrl: launch.chromeCdpUrl,
      profileDir: launch.profileDir,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível abrir o Chrome.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: await getChromeInstagramStatus(),
  });
}
