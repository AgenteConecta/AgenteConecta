export type EvolutionWebhookPayload = {
  event: string;
  instance: string;
  data?: {
    key?: {
      id?: string;
      remoteJid?: string;
      fromMe?: boolean;
    };
    message?: {
      conversation?: string;
    };
    pushName?: string;
  };
};

export function extractEvolutionInbound(payload: EvolutionWebhookPayload) {
  const remoteJid = payload.data?.key?.remoteJid;
  const phone = remoteJid?.split("@")[0] ?? null;
  return {
    providerMessageId: payload.data?.key?.id ?? null,
    phone,
    displayName: payload.data?.pushName ?? null,
    text: payload.data?.message?.conversation ?? "",
    fromMe: payload.data?.key?.fromMe ?? false,
  };
}
