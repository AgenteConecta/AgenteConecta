import { env, integrationReady } from "@/lib/env";

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

export async function sendEvolutionMessage(input: EvolutionSendMessageInput): Promise<EvolutionSendMessageResult> {
  const ready = integrationReady(env.evolutionApiUrl, env.evolutionApiKey, env.evolutionInstance);

  if (env.appMode !== "production" || !ready) {
    return {
      provider: "evolution",
      mode: "dry_run",
      externalId: null,
    };
  }

  const response = await fetch(`${env.evolutionApiUrl}/message/sendText/${env.evolutionInstance}`, {
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
