import type { AiToolCall, AiToolSpec } from "@/features/coach/coach-tools";
import type { AiItemEdit } from "@/features/development/item-ai";
import type { DevelopmentPlan } from "@/features/development/plan";
import type { GoalPlan, GoalQuestions } from "@/features/goals/plan";
import type { RankedAnalysis } from "@/features/ranked/analysis";

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
  /** Outils appelés par le modèle (propositions, à valider avant usage). */
  toolCalls: AiToolCall[];
  usage: AiUsage;
};

export type PlanResult = {
  /** Null si le modèle a refusé ou si la réponse n'a pas pu être lue. */
  plan: GoalPlan | null;
  refused: boolean;
  usage: AiUsage;
};

export type QuestionsResult = {
  /** Null si le modèle a refusé ou si la réponse n'a pas pu être lue. */
  questions: GoalQuestions | null;
  refused: boolean;
  usage: AiUsage;
};

export type DevelopmentPlanResult = {
  /** Null si détresse, refus, réponse coupée ou illisible. */
  plan: DevelopmentPlan | null;
  /** Le modèle a signalé une détresse : montrer des ressources d'aide. */
  crisis: boolean;
  refused: boolean;
  usage: AiUsage;
};

export type RankedAnalysisResult = {
  /** Null si refus ou réponse illisible. */
  analysis: RankedAnalysis | null;
  refused: boolean;
  usage: AiUsage;
};

export type ItemEditResult = {
  /** Null si refus ou réponse illisible (normalisée ensuite avec l'élément actuel). */
  edit: AiItemEdit | null;
  refused: boolean;
  usage: AiUsage;
};

export interface AiProvider {
  /** Réponse du coach, transmise morceau par morceau à `onText`. */
  streamChat(input: {
    system: SystemPrompt;
    turns: ChatTurn[];
    /** Outils que le modèle peut appeler (jamais exécutés automatiquement). */
    tools?: AiToolSpec[];
    onText: (delta: string) => void;
    signal?: AbortSignal;
  }): Promise<ChatResult>;

  /** Questions à poser avant le plan d'un objectif, en sortie structurée. */
  generateGoalQuestions(input: {
    system: string;
    prompt: string;
  }): Promise<QuestionsResult>;

  /** Plan d'objectif en sortie structurée (jalons, tâches, habitudes). */
  generateGoalPlan(input: {
    system: string;
    prompt: string;
    /** Échéance maximale des tâches, en jours (date cible de l'objectif). */
    maxDueInDays?: number;
  }): Promise<PlanResult>;

  /** Plan complet de « Mon développement » en sortie structurée. */
  generateDevelopmentPlan(input: {
    system: string;
    prompt: string;
  }): Promise<DevelopmentPlanResult>;

  /** Analyse d'un niveau Ranked (déjà calculé) en sortie structurée. */
  generateRankedAnalysis(input: {
    system: string;
    prompt: string;
  }): Promise<RankedAnalysisResult>;

  /** Nouveaux champs d'un élément du calendrier, d'après la demande de la personne. */
  suggestItemEdit(input: {
    system: string;
    prompt: string;
  }): Promise<ItemEditResult>;
}
