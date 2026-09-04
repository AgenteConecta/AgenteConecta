import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getOperationalPause, setOperationalPause } from "@/features/safety/operation-pause";

export async function GET() {
  return NextResponse.json({
    ok: true,
    pause: await getOperationalPause(),
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { paused?: boolean };
  const result = await setOperationalPause(Boolean(payload.paused));

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/leads");

  return NextResponse.json({
    ok: true,
    pause: result.pause,
    message: result.message,
  });
}
