import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiGoalPlanSchema, normalizeGoalPlan } from "@/features/goals/plan";
import type { AiProvider, AiUsage } from "./types";

/** Modèle choisi pour Get iT AI (validé à l'étape 8). */
export const CLAUDE_MODEL = "claude-opus-5-5";

/**
 * Si les filtres de sécurité refusent une demande, l'API la relance d'elle-même
 * sur le modèle de repli recommandé, dans le même appel.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function toUsage(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number | null;
    cache_creation_input_tokens: number | null;
  },
): AiUsage {
  return {
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/** Fournisseur Claude (API d'Anthropic), côté serveur uniquement. */
export function createClaudeProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey });

  return {
    async streamChat({ system, turns, onText, signal }) {
      const stream = client.beta.messages.stream(
        {
          model: CLAUDE_MODEL,
          // Réponses courtes de coach : la limite ne sert que de garde-fou
          max_tokens: 8000,
          // La conversation est un usage léger : peu de réflexion, réponse rapide
          output_config: { effort: "low" },
          // Cache automatique : consignes et début de conversation réutilisés
          cache_control: { type: "ephemeral" },
          system: [
            { type: "text", text: system.instructions },
            { type: "text", text: system.context },
          ],
          messages: turns.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { signal },
      );
      stream.on("text", onText);
      const message = await stream.finalMessage();

      const refused = message.stop_reason === "refusal";
      const text = message.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("");
      return {
        // Refus de toute la chaîne : la réponse partielle est écartée
        text: refused ? "" : text,
        refused,
        truncated: message.stop_reason === "max_tokens",
        usage: toUsage(message.model, message.usage),
      };
    },

    async generateGoalPlan({ system, prompt, maxDueInDays }) {
      const message = await client.beta.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        // Découper un objectif demande plus de réflexion qu'une réponse de coach
        output_config: {
          effort: "medium",
          format: betaZodOutputFormat(aiGoalPlanSchema),
        },
        system,
        messages: [{ role: "user", content: prompt }],
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      });

      const refused = message.stop_reason === "refusal";
      const parsed = refused ? null : message.parsed_output;
      return {
        plan: parsed ? normalizeGoalPlan(parsed, { maxDueInDays }) : null,
        refused,
        usage: toUsage(message.model, message.usage),
      };
    },
  };
}
