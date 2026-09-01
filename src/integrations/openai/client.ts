import OpenAI from "openai";
import { env, integrationReady } from "@/lib/env";

export function getOpenAIClient(): OpenAI | null {
  if (!integrationReady(env.openaiApiKey, env.openaiModel, env.openaiModelFast)) {
    return null;
  }

  return new OpenAI({
    apiKey: env.openaiApiKey,
  });
}

export function requireModel(kind: "main" | "fast"): string {
  const model = kind === "main" ? env.openaiModel : env.openaiModelFast;
  if (!model) {
    throw new Error(`Missing ${kind === "main" ? "OPENAI_MODEL" : "OPENAI_MODEL_FAST"}`);
  }
  return model;
}
