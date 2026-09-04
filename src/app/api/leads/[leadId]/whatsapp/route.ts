import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sendWhatsAppForLead } from "@/features/outreach/whatsapp-actions";

type Params = Promise<{
  leadId: string;
}>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { leadId } = await params;
  const payload = (await request.json().catch(() => ({}))) as {
    phone?: string;
    message?: string;
  };
  const result = await sendWhatsAppForLead({
    leadId,
    phone: String(payload.phone ?? ""),
    message: typeof payload.message === "string" ? payload.message : undefined,
  });

  revalidatePath("/");
  revalidatePath("/leads");

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
