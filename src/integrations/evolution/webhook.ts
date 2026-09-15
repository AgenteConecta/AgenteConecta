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
    text: normalizeEvolutionInboundText(payload.data?.message?.conversation ?? ""),
    fromMe: payload.data?.key?.fromMe ?? false,
  };
}

export function normalizeEvolutionInboundText(input: string) {
  const text = input.trim();

  if (!text) {
    return "";
  }

  const looksUrlEncoded = /%[0-9a-f]{2}|\+/.test(text);

  if (!looksUrlEncoded) {
    return text;
  }

  try {
    return decodeURIComponent(text.replace(/\+/g, " ")).trim();
  } catch {
    return text;
  }
}
