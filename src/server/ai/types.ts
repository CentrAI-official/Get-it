import type { GoalPlan } from "@/features/goals/plan";

// Couche d'abstraction (§53) : le reste de l'application ne connaît que ces
// types, jamais le SDK d'un fournisseur.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AiUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type SystemPrompt = {
  /** Consignes stables (mises en cache). */
  instructions: string;
  /** Données de l'utilisateur, qui changent d'une requête à l'autre. */
  context: string;
};

export type ChatResult = {
  /** Réponse complète ; vide si le modèle a refusé. */
  text: string;
  /** Refus des filtres de sécurité, même après le repli sur un autre modèle. */
  refused: boolean;
  /** Réponse coupée par la limite de longueur. */
  truncated: boolean;
  usage: AiUsage;
};

export type PlanResult = {
  /** Null si le modèle a refusé ou si la réponse n'a pas pu être lue. */
  plan: GoalPlan | null;
  refused: boolean;
  usage: AiUsage;
};

export interface AiProvider {
  /** Réponse du coach, transmise morceau par morceau à `onText`. */
  streamChat(input: {
    system: SystemPrompt;
    turns: ChatTurn[];
    onText: (delta: string) => void;
    signal?: AbortSignal;
  }): Promise<ChatResult>;

  /** Plan d'objectif en sortie structurée (jalons, tâches, habitudes). */
  generateGoalPlan(input: {
    system: string;
    prompt: string;
    /** Échéance maximale des tâches, en jours (date cible de l'objectif). */
    maxDueInDays?: number;
  }): Promise<PlanResult>;
}
