import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { setOperationalAppMode } from "@/features/safety/app-mode";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { mode?: string };
  const result = await setOperationalAppMode(String(payload.mode ?? "dry_run"));

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/leads");

  return NextResponse.json({
    ok: true,
    mode: result.mode,
  });
}
