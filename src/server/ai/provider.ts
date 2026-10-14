import "server-only";
import { getServerEnv } from "@/server/env";
import { createClaudeProvider } from "./claude";
import { createFakeProvider } from "./fake";
import type { AiProvider } from "./types";

let cached: AiProvider | null | undefined;

/**
 * Fournisseur d'IA configuré, ou null tant que Get iT AI n'est pas activé
 * (pas de clé ANTHROPIC_API_KEY).
 */
export function getAiProvider(): AiProvider | null {
  if (cached !== undefined) return cached;
  const env = getServerEnv();
  if (env.AI_PROVIDER === "fake") {
    cached = createFakeProvider();
  } else if (env.ANTHROPIC_API_KEY) {
    cached = createClaudeProvider(env.ANTHROPIC_API_KEY);
  } else {
    cached = null;
  }
  return cached;
}

/** Vrai si Get iT AI peut répondre. */
export function isAiConfigured() {
  return getAiProvider() !== null;
}
