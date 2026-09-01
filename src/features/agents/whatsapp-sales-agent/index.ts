import { salesDecisionSchema, type SalesDecision } from "@/features/conversations/agent-schema";

export function parseWhatsappSalesDecision(raw: unknown): SalesDecision {
  return salesDecisionSchema.parse(raw);
}

export const whatsappSalesAgentPurpose =
  "Agente comercial WhatsApp preparado para receber prompt completo posterior, sempre devolvendo JSON validado.";
