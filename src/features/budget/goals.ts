import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { isBudgetError, parseAmount, type BudgetError } from "./rules";

// Les objectifs d'épargne : un montant à atteindre, peut-être pour une date. Ce
// qui est mis de côté vient des transactions liées à l'objectif. Fonctions pures.
// Limites alignées sur la migration 20261118120000_budget_complete.

export const GOAL_NAME_MAX = 40;
export const MAX_GOALS = 20;
/** Le fonds d'urgence : de 3 à 6 mois de dépenses (Agence de la consommation en matière financière du Canada). */
export const EMERGENCY_MONTHS = 3;

export type BudgetGoalRow = {
  id: string;
  name: string;
  targetCents: number;
  targetOn: string | null;
  startingCents: number;
  /** Mis de côté par les transactions liées. */
  addedCents: number;
};

/** Mois entiers entre deux jours ; 0 si la date est passée. */
function monthsBetween(from: string, to: string) {
  const months =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5, 7)) -
    Number(from.slice(5, 7));
  return Math.max(0, months);
}

/** Où en est un objectif, et combien mettre de côté par mois pour arriver à temps. */
export function goalProgress(
  goal: Pick<
    BudgetGoalRow,
    "targetCents" | "targetOn" | "startingCents" | "addedCents"
  >,
  today: string,
) {
  const savedCents = goal.startingCents + goal.addedCents;
  const leftCents = Math.max(0, goal.targetCents - savedCents);
  const done = leftCents === 0;
  let monthsLeft: number | null = null;
  let monthlyCents: number | null = null;
  if (goal.targetOn && !done) {
    monthsLeft = monthsBetween(today, goal.targetOn);
    // Le mois de la date compte : un objectif pour le mois prochain, c'est 2 mois
    monthlyCents =
      goal.targetOn < today
        ? leftCents
        : Math.ceil(leftCents / (monthsLeft + 1));
  }
  return {
    savedCents,
    leftCents,
    done,
    percent: Math.min(100, Math.floor((savedCents / goal.targetCents) * 100)),
    monthsLeft,
    monthlyCents,
    late: goal.targetOn !== null && goal.targetOn < today && !done,
  };
}

const error = (key: BudgetError) => ({ error: key });

const GOAL_FIELDS = ["name", "target", "targetOn", "starting"] as const;
export type GoalField = (typeof GOAL_FIELDS)[number];

/** Formulaire d'un objectif d'épargne. */
export const goalFormSchema = z
  .object({
    name: z
      .string(error("labelRequired"))
      .trim()
      .min(1, error("labelRequired"))
      .max(GOAL_NAME_MAX, error("labelTooLong")),
    target: z.string(error("amountInvalid")),
    targetOn: z
      .union([z.iso.date(error("dateInvalid")), z.literal("")])
      .optional()
      .transform((value) => value || null),
    starting: z.string().optional().default(""),
  })
  .transform((input, context) => {
    const target = parseAmount(input.target);
    if (target === null) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "amountInvalid",
      });
    }
    const starting = input.starting.trim() ? parseAmount(input.starting) : 0;
    if (starting === null) {
      context.addIssue({
        code: "custom",
        path: ["starting"],
        message: "amountInvalid",
      });
    }
    return {
      name: input.name,
      targetCents: target ?? 0,
      targetOn: input.targetOn,
      startingCents: starting ?? 0,
    };
  });
export type GoalInput = z.output<typeof goalFormSchema>;

export function goalFieldErrors(zodError: z.ZodError) {
  return fieldErrorsFrom(zodError, GOAL_FIELDS, isBudgetError, "unexpected");
}
