import "server-only";
import { normalizeGoalPlan } from "@/features/goals/plan";
import type { AiProvider, AiUsage } from "./types";

// Fournisseur factice (AI_PROVIDER=fake) : réponses fixes, sans appel payant,
// pour les tests de bout en bout. Refusé en production (voir src/server/env.ts).

const usage: AiUsage = {
  model: "fake",
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFakeProvider(): AiProvider {
  return {
    async streamChat({ turns, onText }) {
      const question = turns.at(-1)?.content ?? "";
      // « refus » dans la question : simule un refus des filtres de sécurité
      if (question.toLowerCase().includes("refus")) {
        return { text: "", refused: true, truncated: false, usage };
      }
      const text = `Réponse de test à « ${question.slice(0, 60)} ».\n\n- **Première action** : coche une quête.\n- Deuxième action : fais ton check-in.`;
      for (const word of text.split(/(?<= )/)) {
        onText(word);
        await pause(15);
      }
      return { text, refused: false, truncated: false, usage };
    },

    async generateGoalPlan({ maxDueInDays }) {
      await pause(300);
      return {
        plan: normalizeGoalPlan(
          {
            summary: "Plan de test en trois étapes.",
            milestones: [
              { title: "Jalon de test A" },
              { title: "Jalon de test B" },
              { title: "Jalon de test C" },
            ],
            tasks: [
              { title: "Tâche de test 1", dueInDays: 0 },
              { title: "Tâche de test 2", dueInDays: 3 },
            ],
            habits: [{ title: "Habitude de test", weekdays: [1, 3, 5] }],
          },
          { maxDueInDays },
        ),
        refused: false,
        usage,
      };
    },
  };
}
