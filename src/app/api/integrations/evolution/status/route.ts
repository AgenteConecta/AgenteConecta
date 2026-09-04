import { NextResponse } from "next/server";
import { getEvolutionStatus } from "@/integrations/evolution/evolution-client";

export async function GET() {
  return NextResponse.json(await getEvolutionStatus());
}
