import { env, integrationReady, normalizeBaseUrl } from "@/lib/env";

export type EvolutionSendMessageInput = {
  leadId: string;
  phone: string;
  message: string;
};

export type EvolutionSendMessageResult = {
  provider: "evolution";
  mode: "dry_run" | "live";
  externalId: string | null;
};

export function getEvolutionStatus() {
  return {
    configured: integrationReady(env.evolutionApiUrl, env.evolutionApiKey, env.evolutionInstance),
    mode: env.appMode,
    liveSendEnabled: env.appMode === "production",
    instanceConfigured: Boolean(env.evolutionInstance),
  };
}

export function buildEvolutionUrl(path: string): string {
  if (!env.evolutionApiUrl) {
    throw new Error("Missing EVOLUTION_API_URL");
  }

  return `${normalizeBaseUrl(env.evolutionApiUrl)}${path}`;
}

export function encodeEvolutionInstance(instance: string): string {
  return encodeURIComponent(instance);
}

export async function sendEvolutionMessage(input: EvolutionSendMessageInput): Promise<EvolutionSendMessageResult> {
  const ready = integrationReady(env.evolutionApiUrl, env.evolutionApiKey, env.evolutionInstance);

  if (env.appMode !== "production" || !ready) {
    return {
      provider: "evolution",
      mode: "dry_run",
      externalId: null,
    };
  }

  const instance = encodeEvolutionInstance(env.evolutionInstance as string);
  const response = await fetch(buildEvolutionUrl(`/message/sendText/${instance}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.evolutionApiKey as string,
    },
    body: JSON.stringify({
      number: input.phone,
      text: input.message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Evolution API failed with ${response.status}`);
  }

  const payload = (await response.json()) as { key?: { id?: string } };
  return {
    provider: "evolution",
    mode: "live",
    externalId: payload.key?.id ?? null,
  };
}
