import "server-only";
import { normalizeDevelopmentPlan } from "@/features/development/plan";
import { normalizeGoalPlan } from "@/features/goals/plan";
import { normalizeRankedAnalysis } from "@/features/ranked/analysis";
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
        return {
          text: "",
          refused: true,
          truncated: false,
          toolCalls: [],
          usage,
        };
      }
      // « ajoute » dans la question : simule trois propositions du coach
      const toolCalls = question.toLowerCase().includes("ajoute")
        ? [
            {
              name: "propose_habit",
              input: {
                title: "Habitude du coach",
                pillar: "mental",
                weekdays: [1, 3, 5],
                goal_ref: "G1",
              },
            },
            {
              name: "propose_task",
              input: {
                title: "Tâche du coach",
                due_date: null,
                goal_ref: null,
              },
            },
            {
              name: "propose_goal",
              input: {
                title: "Objectif du coach",
                pillar: "financial",
                description: null,
                target_date: null,
              },
            },
          ]
        : [];
      const text = `Réponse de test à « ${question.slice(0, 60)} ».\n\n- **Première action** : coche une quête.\n- Deuxième action : fais ton check-in.`;
      for (const word of text.split(/(?<= )/)) {
        onText(word);
        await pause(15);
      }
      return { text, refused: false, truncated: false, toolCalls, usage };
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

    async generateDevelopmentPlan({ prompt }) {
      await pause(300);
      // « crise » dans une réponse : simule une détresse détectée
      if (prompt.toLowerCase().includes("crise")) {
        return { plan: null, crisis: true, refused: false, usage };
      }
      const kind = /Plan type: (\w+)/.exec(prompt)?.[1] ?? "physical";
      // Demande de modification : un titre différent, pour la reconnaître
      const revised = prompt.includes("Changes the user wants");
      return {
        plan: normalizeDevelopmentPlan({
          crisis: false,
          title: revised ? `Plan modifié (${kind})` : `Plan de test (${kind})`,
          summary: "Un plan de test, généré sans appel à Get iT AI.",
          highlights: [
            { label: "Séances par semaine", value: "3" },
            { label: "Durée", value: "45 min" },
          ],
          schedule: [
            {
              weekday: 1,
              moment: "morning",
              title: "Haut du corps",
              items: [
                { name: "Échauffement", detail: "5 min de vélo" },
                { name: "Pompes", detail: "3 × 10, repos 60 s" },
              ],
            },
            {
              weekday: 4,
              moment: null,
              title: "Bas du corps",
              items: [{ name: "Squats", detail: "3 × 12, repos 60 s" }],
            },
          ],
          sections: [
            {
              title: "Alimentation",
              items: [
                {
                  title: "Protéines",
                  detail: "Une source de protéines à chaque repas.",
                },
              ],
            },
          ],
          goal: { title: "Objectif de test", targetInDays: 90 },
          habits: [
            { title: "Habitude de test", weekdays: [1, 4], moment: "evening" },
          ],
          tasks: [{ title: "Tâche de test", dueInDays: 2 }],
          caution: "Consulte un professionnel au besoin.",
        }),
        crisis: false,
        refused: false,
        usage,
      };
    },

    async generateRankedAnalysis() {
      await pause(300);
      return {
        analysis: normalizeRankedAnalysis({
          summary: "Analyse de test, générée sans appel à Get iT AI.",
          pillars: {
            physical: "Ton cardio est au cœur de ton niveau physique.",
            financial:
              "Ton revenu par heure et ton patrimoine, comparés à ton âge.",
          },
          tips: [
            {
              pillar: "physical",
              title: "Conseil de test",
              detail: "Trois séances de cardio par semaine.",
            },
          ],
        }),
        refused: false,
        usage,
      };
    },
  };
}
