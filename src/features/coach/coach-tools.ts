import { z } from "zod";
import { PILLARS, type Pillar } from "@/config/pillars";
import {
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_TITLE_MAX_LENGTH,
  GOAL_TITLE_MIN_LENGTH,
  ITEM_TITLE_MAX_LENGTH,
} from "@/features/goals/schemas";
import { HABIT_TITLE_MAX_LENGTH, WEEKDAYS } from "@/features/habits/schemas";
import { addDays } from "@/lib/dates";

// Ajouts proposés par Get iT AI : le modèle appelle un outil « propose_* », le
// serveur en fait une carte « Ajouter / Ignorer ». Rien n'est créé sans accord.

/** Outil offert au modèle (indépendant du fournisseur). */
export type AiToolSpec = {
  name: string;
  description: string;
  /** JSON Schema de l'entrée. */
  inputSchema: Record<string, unknown>;
};

/** Appel d'outil renvoyé par le modèle (entrée non vérifiée). */
export type AiToolCall = { name: string; input: unknown };

/** Objectif en cours, avec la référence courte donnée au modèle (G1, G2…). */
export type GoalRef = {
  ref: string;
  id: string;
  title: string;
  pillar: Pillar;
};

/** Propositions au plus par réponse : le coach reste une aide, pas un formulaire. */
export const MAX_ACTIONS_PER_REPLY = 3;

const pillarProperty = {
  type: "string",
  enum: [...PILLARS],
  description: "Pillar: physical, mental, social or financial.",
};
const goalRefProperty = (required: boolean) => ({
  type: required ? "string" : ["string", "null"],
  description: `Ref of an active goal from <user_context> (e.g. "G1")${
    required ? "." : ", or null when it isn't tied to a goal."
  }`,
});

export const COACH_TOOLS: AiToolSpec[] = [
  {
    name: "propose_goal",
    description:
      "Propose a new goal. Call it when the user asks to set or create a goal, or agrees to a goal you suggested. The user sees a card and must confirm; nothing is created before that.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short goal title." },
        pillar: pillarProperty,
        description: {
          type: ["string", "null"],
          description: "Optional one-sentence description, or null.",
        },
        target_date: {
          type: ["string", "null"],
          description:
            "Optional target date YYYY-MM-DD in the future, or null.",
        },
      },
      required: ["title", "pillar"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_habit",
    description:
      "Propose a new recurring habit. Call it when the user asks to add or start a habit, or agrees to one you suggested. The user must confirm.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: 'Short action, e.g. "Read 20 pages".',
        },
        pillar: pillarProperty,
        weekdays: {
          type: "array",
          items: { type: "integer" },
          description: "Days it is planned, 1 (Monday) to 7 (Sunday).",
        },
        goal_ref: goalRefProperty(false),
      },
      required: ["title", "pillar", "weekdays"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_task",
    description:
      "Propose a one-time task. Call it when the user asks to add or schedule something to do, or agrees to a task you suggested. The user must confirm.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Concrete action doable in one sitting.",
        },
        due_date: {
          type: ["string", "null"],
          description: "Due date YYYY-MM-DD (today or later), or null.",
        },
        goal_ref: goalRefProperty(false),
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_milestone",
    description:
      "Propose a milestone for one of the user's active goals. Call it when the user asks to break a goal down or add a step to it. The user must confirm.",
    inputSchema: {
      type: "object",
      properties: {
        goal_ref: goalRefProperty(true),
        title: { type: "string", description: "Measurable checkpoint." },
      },
      required: ["goal_ref", "title"],
      additionalProperties: false,
    },
  },
];

const day = z.iso.date();
const linkedGoal = z.object({ id: z.uuid(), title: z.string() }).nullable();

/** Proposition validée, telle qu'elle est enregistrée (et relue) en base. */
export const coachActionPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("goal"),
    title: z.string().min(GOAL_TITLE_MIN_LENGTH).max(GOAL_TITLE_MAX_LENGTH),
    pillar: z.enum(PILLARS),
    description: z.string().max(GOAL_DESCRIPTION_MAX_LENGTH).nullable(),
    targetDate: day.nullable(),
  }),
  z.object({
    kind: z.literal("habit"),
    title: z.string().min(1).max(HABIT_TITLE_MAX_LENGTH),
    pillar: z.enum(PILLARS),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    goal: linkedGoal,
  }),
  z.object({
    kind: z.literal("task"),
    title: z.string().min(1).max(ITEM_TITLE_MAX_LENGTH),
    dueDate: day.nullable(),
    goal: linkedGoal,
  }),
  z.object({
    kind: z.literal("milestone"),
    title: z.string().min(1).max(ITEM_TITLE_MAX_LENGTH),
    goal: z.object({ id: z.uuid(), title: z.string() }),
  }),
]);

export type CoachActionPayload = z.infer<typeof coachActionPayloadSchema>;

export type CoachActionView = {
  id: string;
  status: "pending" | "applied" | "dismissed";
  /** Élément créé (objectif, habitude) une fois accepté. */
  createdId: string | null;
  payload: CoachActionPayload;
};

const clean = (text: unknown, max: number) =>
  typeof text === "string"
    ? text.replace(/\s+/g, " ").trim().slice(0, max)
    : "";

const toolInput = z.object({
  title: z.unknown(),
  pillar: z.unknown().optional(),
  description: z.unknown().optional(),
  target_date: z.unknown().optional(),
  due_date: z.unknown().optional(),
  weekdays: z.unknown().optional(),
  goal_ref: z.unknown().optional(),
});

/**
 * Transforme un appel d'outil en proposition valide, ou null s'il est
 * inutilisable (outil inconnu, titre vide, objectif introuvable…). Les dates
 * passées ou trop lointaines sont corrigées plutôt que refusées.
 */
export function parseToolCall(
  call: AiToolCall,
  { today, goals }: { today: string; goals: GoalRef[] },
): CoachActionPayload | null {
  const input = toolInput.safeParse(call.input);
  if (!input.success) return null;
  const data = input.data;
  const goalFor = (ref: unknown) => {
    const goal = goals.find((item) => item.ref === ref);
    return goal ? { id: goal.id, title: goal.title } : null;
  };
  const pillar = PILLARS.find((item) => item === data.pillar);
  const date = (value: unknown, maxDays: number) => {
    const parsed = day.safeParse(value);
    if (!parsed.success) return null;
    if (parsed.data < today) return today;
    return parsed.data > addDays(today, maxDays) ? null : parsed.data;
  };

  let payload: unknown = null;
  if (call.name === "propose_goal") {
    payload = {
      kind: "goal",
      title: clean(data.title, GOAL_TITLE_MAX_LENGTH),
      pillar,
      description: clean(data.description, GOAL_DESCRIPTION_MAX_LENGTH) || null,
      targetDate: date(data.target_date, 3650),
    };
  } else if (call.name === "propose_habit") {
    const weekdays = Array.isArray(data.weekdays)
      ? [...new Set(data.weekdays)]
          .filter((d): d is number =>
            WEEKDAYS.includes(d as (typeof WEEKDAYS)[number]),
          )
          .sort((a, b) => a - b)
      : [];
    payload = {
      kind: "habit",
      title: clean(data.title, HABIT_TITLE_MAX_LENGTH),
      pillar,
      weekdays: weekdays.length > 0 ? weekdays : [...WEEKDAYS],
      goal: goalFor(data.goal_ref),
    };
  } else if (call.name === "propose_task") {
    payload = {
      kind: "task",
      title: clean(data.title, ITEM_TITLE_MAX_LENGTH),
      dueDate: date(data.due_date, 365),
      goal: goalFor(data.goal_ref),
    };
  } else if (call.name === "propose_milestone") {
    payload = {
      kind: "milestone",
      title: clean(data.title, ITEM_TITLE_MAX_LENGTH),
      goal: goalFor(data.goal_ref),
    };
  }

  const parsed = coachActionPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_TEXT = {
  pending: "not confirmed yet",
  applied: "added by the user",
  dismissed: "dismissed by the user",
} as const;

/**
 * Rappel des propositions d'une réponse, ajouté à son texte dans l'historique
 * renvoyé au modèle : il sait ce que l'utilisateur a accepté ou refusé.
 */
export function describeActions(
  actions: { status: CoachActionView["status"]; payload: CoachActionPayload }[],
): string {
  if (actions.length === 0) return "";
  const lines = actions.map(({ status, payload }) => {
    const detail =
      payload.kind === "habit"
        ? ` (${payload.weekdays.length === 7 ? "every day" : payload.weekdays.map((d) => WEEKDAY_NAMES[d - 1]).join(", ")})`
        : payload.kind === "task" && payload.dueDate
          ? ` (due ${payload.dueDate})`
          : "";
    return `- ${payload.kind} "${payload.title}"${detail}: ${STATUS_TEXT[status]}`;
  });
  return `[Proposals shown as cards]\n${lines.join("\n")}`;
}
