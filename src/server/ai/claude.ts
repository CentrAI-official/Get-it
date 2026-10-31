import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  aiDevelopmentPlanSchema,
  normalizeDevelopmentPlan,
} from "@/features/development/plan";
import {
  aiGoalPlanSchema,
  aiGoalQuestionsSchema,
  normalizeGoalPlan,
  normalizeGoalQuestions,
} from "@/features/goals/plan";
import {
  aiRankedAnalysisSchema,
  normalizeRankedAnalysis,
} from "@/features/ranked/analysis";
import { aiItemEditSchema } from "@/features/development/item-ai";
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
    async streamChat({ system, turns, tools = [], onText, signal }) {
      let streamedText = "";
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
          // Entrées des outils transmises au fil de l'eau : validées ensuite par le serveur
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema:
              tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
            eager_input_streaming: true,
          })),
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { signal },
      );
      stream.on("text", (delta) => {
        streamedText += delta;
        onText(delta);
      });

      let message;
      try {
        message = await stream.finalMessage();
      } catch (error) {
        // Entrée d'outil illisible (JSON invalide) : on garde le texte, sans proposition.
        // Les erreurs de l'API (clé, limite…) et les annulations remontent telles quelles.
        if (
          error instanceof Anthropic.APIError ||
          signal?.aborted ||
          !streamedText
        ) {
          throw error;
        }
        return {
          text: streamedText,
          refused: false,
          truncated: false,
          toolCalls: [],
          usage: toUsage(CLAUDE_MODEL, {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          }),
        };
      }

      const refused = message.stop_reason === "refusal";
      const truncated = message.stop_reason === "max_tokens";
      const text = message.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("");
      const toolCalls = message.content.flatMap((block) =>
        block.type === "tool_use"
          ? [{ name: block.name, input: block.input }]
          : [],
      );
      // Réponse coupée : le dernier appel d'outil peut être incomplet, on l'écarte
      if (truncated) toolCalls.pop();
      return {
        // Refus de toute la chaîne : la réponse partielle et ses outils sont écartés
        text: refused ? "" : text,
        refused,
        truncated,
        toolCalls: refused ? [] : toolCalls,
        usage: toUsage(message.model, message.usage),
      };
    },

    async generateGoalQuestions({ system, prompt }) {
      const message = await client.beta.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        // Quelques questions courtes : peu de réflexion suffit
        output_config: {
          effort: "low",
          format: betaZodOutputFormat(aiGoalQuestionsSchema),
        },
        system,
        messages: [{ role: "user", content: prompt }],
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      });

      const refused = message.stop_reason === "refusal";
      const parsed = refused ? null : message.parsed_output;
      return {
        questions: parsed ? normalizeGoalQuestions(parsed) : null,
        refused,
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

    async generateDevelopmentPlan({ system, prompt }) {
      // Un plan complet est long : en flux, pour rester sous le délai d'une
      // requête simple, avec la sortie structurée lue à la fin
      const stream = client.beta.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 32000,
        output_config: {
          effort: "medium",
          format: betaZodOutputFormat(aiDevelopmentPlanSchema),
        },
        system,
        messages: [{ role: "user", content: prompt }],
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      });
      const message = await stream.finalMessage();

      const refused = message.stop_reason === "refusal";
      // Réponse coupée : le JSON est incomplet, rien n'est gardé
      const parsed =
        refused || message.stop_reason === "max_tokens"
          ? null
          : message.parsed_output;
      return {
        plan: parsed ? normalizeDevelopmentPlan(parsed) : null,
        crisis: parsed?.crisis ?? false,
        refused,
        usage: toUsage(message.model, message.usage),
      };
    },

    async generateRankedAnalysis({ system, prompt }) {
      // Expliquer un niveau déjà calculé : réponse courte, peu de réflexion
      const message = await client.beta.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        output_config: {
          effort: "low",
          format: betaZodOutputFormat(aiRankedAnalysisSchema),
        },
        system,
        messages: [{ role: "user", content: prompt }],
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      });

      const refused = message.stop_reason === "refusal";
      const parsed =
        refused || message.stop_reason === "max_tokens"
          ? null
          : message.parsed_output;
      return {
        analysis: parsed ? normalizeRankedAnalysis(parsed) : null,
        refused,
        usage: toUsage(message.model, message.usage),
      };
    },

    async suggestItemEdit({ system, prompt }) {
      // Quelques champs à remplir : réponse courte, peu de réflexion
      const message = await client.beta.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        output_config: {
          effort: "low",
          format: betaZodOutputFormat(aiItemEditSchema),
        },
        system,
        messages: [{ role: "user", content: prompt }],
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      });

      const refused = message.stop_reason === "refusal";
      const parsed =
        refused || message.stop_reason === "max_tokens"
          ? null
          : message.parsed_output;
      return {
        edit: parsed ?? null,
        refused,
        usage: toUsage(message.model, message.usage),
      };
    },
  };
}
