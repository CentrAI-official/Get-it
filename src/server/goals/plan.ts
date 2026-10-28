import "server-only";
import {
  goalPlanInstructions,
  goalPlanPrompt,
  goalQuestionsInstructions,
  goalQuestionsPrompt,
  type GoalPlanRequest,
} from "@/features/coach/prompts";
import type {
  GoalAnswers,
  GoalPlan,
  GoalPlanSelection,
  GoalQuestions,
} from "@/features/goals/plan";
import { addDays, daysBetween, toCalendarDay, toDbDate } from "@/lib/dates";
import { getAiProvider } from "@/server/ai/provider";
import {
  getAiProfile,
  recordAiUsage,
  releaseAiRequest,
  reserveAiRequest,
} from "@/server/ai/usage";
import { db } from "@/server/db";
import { listHabits } from "@/server/habits/service";
import { getGoal } from "./service";

export type GoalPlanError =
  | "notConfigured"
  | "consentRequired"
  | "notFound"
  | "limitReached"
  | "refused"
  | "unexpected";

/** Ce que Get iT AI sait déjà de l'objectif (jamais l'historique brut). */
async function planRequest(
  userId: string,
  goal: NonNullable<Awaited<ReturnType<typeof getGoal>>>,
  profile: NonNullable<Awaited<ReturnType<typeof getAiProfile>>>,
  today: string,
): Promise<GoalPlanRequest> {
  const habits = await listHabits(userId, profile.timeZone);
  return {
    today,
    goal: {
      title: goal.title,
      description: goal.description,
      pillar: goal.pillar,
      targetDate: goal.targetDate,
      milestones: goal.milestones,
      tasks: goal.tasks,
    },
    occupation: profile.occupation,
    dailyMinutes: profile.dailyMinutes,
    habits: habits.filter((habit) => !habit.archived).map((h) => h.title),
  };
}

/**
 * Questions de Get iT AI avant le plan d'un objectif (situation actuelle,
 * contraintes). Compte comme une requête du jour.
 */
export async function generateGoalQuestions(
  userId: string,
  goalId: string,
): Promise<
  | { ok: true; questions: GoalQuestions; remaining: number }
  | { ok: false; error: GoalPlanError }
> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, error: "notConfigured" };
  const profile = await getAiProfile(userId);
  if (!profile) return { ok: false, error: "notFound" };
  if (!profile.consented) return { ok: false, error: "consentRequired" };
  const goal = await getGoal(userId, goalId);
  if (!goal) return { ok: false, error: "notFound" };

  const reservation = await reserveAiRequest(
    userId,
    "goal_plan",
    profile.timeZone,
  );
  if (!reservation) return { ok: false, error: "limitReached" };
  const today = toCalendarDay(new Date(), profile.timeZone);
  const request = await planRequest(userId, goal, profile, today);
  const result = await provider
    .generateGoalQuestions({
      system: goalQuestionsInstructions(profile.locale),
      prompt: goalQuestionsPrompt(request),
    })
    .catch(async (error: unknown) => {
      await releaseAiRequest(reservation.id).catch(() => {});
      throw error;
    });
  await recordAiUsage(reservation.id, result.usage);
  if (result.refused) return { ok: false, error: "refused" };
  if (!result.questions || result.questions.questions.length === 0) {
    return { ok: false, error: "unexpected" };
  }
  return {
    ok: true,
    questions: result.questions,
    remaining: reservation.remaining,
  };
}

/**
 * Plan proposé par Get iT AI pour un objectif (§8) : jalons, premières tâches
 * et habitudes, d'après les réponses aux questions s'il y en a. Rien n'est
 * créé : l'utilisateur choisit ce qu'il garde.
 */
export async function generateGoalPlan(
  userId: string,
  goalId: string,
  answers: GoalAnswers = [],
): Promise<
  | { ok: true; plan: GoalPlan; remaining: number }
  | { ok: false; error: GoalPlanError }
> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, error: "notConfigured" };
  const profile = await getAiProfile(userId);
  if (!profile) return { ok: false, error: "notFound" };
  if (!profile.consented) return { ok: false, error: "consentRequired" };
  const goal = await getGoal(userId, goalId);
  if (!goal) return { ok: false, error: "notFound" };

  const reservation = await reserveAiRequest(
    userId,
    "goal_plan",
    profile.timeZone,
  );
  if (!reservation) return { ok: false, error: "limitReached" };

  const today = toCalendarDay(new Date(), profile.timeZone);
  const request = await planRequest(userId, goal, profile, today);
  // Les tâches ne tombent jamais après la date cible (si elle n'est pas passée)
  const untilTarget = goal.targetDate
    ? daysBetween(today, goal.targetDate)
    : null;

  const result = await provider
    .generateGoalPlan({
      system: goalPlanInstructions(profile.locale),
      prompt: goalPlanPrompt({ ...request, answers }),
      maxDueInDays:
        untilTarget !== null && untilTarget >= 0 ? untilTarget : undefined,
    })
    .catch(async (error: unknown) => {
      // Rien n'a été produit : la requête ne compte pas dans la limite du jour
      await releaseAiRequest(reservation.id).catch(() => {});
      throw error;
    });
  await recordAiUsage(reservation.id, result.usage);

  if (result.refused) return { ok: false, error: "refused" };
  const plan = result.plan;
  if (
    !plan ||
    plan.milestones.length + plan.tasks.length + plan.habits.length === 0
  ) {
    return { ok: false, error: "unexpected" };
  }
  return { ok: true, plan, remaining: reservation.remaining };
}

/**
 * Crée les éléments du plan gardés par l'utilisateur, en une transaction :
 * jalons à la suite des existants, tâches datées, habitudes liées à
 * l'objectif. Faux si l'objectif n'existe pas pour cet utilisateur.
 */
export async function applyGoalPlan(
  userId: string,
  goalId: string,
  selection: GoalPlanSelection,
) {
  const profile = await getAiProfile(userId);
  if (!profile) return false;
  const today = toCalendarDay(new Date(), profile.timeZone);

  return db.$transaction(async (tx) => {
    const goal = await tx.goal.findFirst({
      where: { id: goalId, userId },
      select: {
        pillar: true,
        milestones: {
          orderBy: { position: "desc" },
          take: 1,
          select: { position: true },
        },
      },
    });
    if (!goal) return false;

    const nextPosition = (goal.milestones[0]?.position ?? -1) + 1;
    await tx.goalMilestone.createMany({
      data: selection.milestones.map((title, index) => ({
        goalId,
        title,
        position: nextPosition + index,
      })),
    });
    await tx.task.createMany({
      data: selection.tasks.map((task) => ({
        userId,
        goalId,
        title: task.title,
        dueDate: toDbDate(addDays(today, task.dueInDays)),
      })),
    });
    await tx.habit.createMany({
      data: selection.habits.map((habit) => ({
        userId,
        goalId,
        title: habit.title,
        pillar: goal.pillar,
        weekdays: [...habit.weekdays].sort((a, b) => a - b),
      })),
    });
    return true;
  });
}
