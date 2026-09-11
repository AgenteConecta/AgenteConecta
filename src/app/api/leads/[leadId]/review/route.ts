import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { approveLeadForOutreachRecord, updateLeadReviewStateRecord } from "@/features/leads/review-repository";

type Params = Promise<{
  leadId: string;
}>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { leadId } = await params;
  const payload = (await request.json().catch(() => ({}))) as {
    action?: string;
    lane?: string;
    username?: string;
    approvedMessage?: string;
  };
  const action = String(payload.action ?? "");
  const lane = String(payload.lane ?? "review");
  const username = String(payload.username ?? "");
  const result =
    action === "approve"
      ? await approveLeadForOutreachRecord({
          leadId,
          lane,
          username,
          approvedMessage: String(payload.approvedMessage ?? ""),
        })
      : await updateLeadReviewStateRecord({
          leadId,
          lane,
          username,
          action,
        });

  revalidatePath("/");
  revalidatePath("/leads");

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
