import { NextResponse } from "next/server";
import { getEvolutionStatus } from "@/integrations/evolution/evolution-client";

export function GET() {
  return NextResponse.json(getEvolutionStatus());
}
