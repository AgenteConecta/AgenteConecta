import { salesDecisionSchema, type SalesDecision } from "@/features/conversations/agent-schema";
import { getOpenAIClient, requireModel } from "@/integrations/openai/client";

export async function createSalesDecision(input: {
  leadId: string;
  context: Record<string, unknown>;
  latestMessage: string;
}): Promise<SalesDecision> {
  const client = getOpenAIClient();

  if (!client) {
    return {
      lead_id: input.leadId,
      intent: "ambiguous",
      action: "escalate_human",
      message: null,
      reason: "OpenAI não configurada; decisão mantida em dry-run para revisão humana.",
      confidence: 0,
      human_review_required: true,
      next_funnel_stage: null,
    };
  }

  const response = await client.responses.create({
    model: requireModel("fast"),
    input: [
      {
        role: "system",
        content:
          "Você classifica mensagens comerciais da Newtek. Responda somente JSON válido compatível com o schema operacional. Nunca inclua raciocínio privado.",
      },
      {
        role: "user",
        content: JSON.stringify({
          lead_id: input.leadId,
          context: input.context,
          latest_message: input.latestMessage,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "sales_decision",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            lead_id: { type: "string" },
            intent: { type: "string" },
            action: { type: "string" },
            message: { type: ["string", "null"] },
            reason: { type: "string" },
            confidence: { type: "number" },
            human_review_required: { type: "boolean" },
            next_funnel_stage: { type: ["string", "null"] },
          },
          required: [
            "lead_id",
            "intent",
            "action",
            "message",
            "reason",
            "confidence",
            "human_review_required",
            "next_funnel_stage",
          ],
        },
      },
    },
  });

  return salesDecisionSchema.parse(JSON.parse(response.output_text));
}
