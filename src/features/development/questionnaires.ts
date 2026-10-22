import type { Pillar } from "@/config/pillars";

// « Mon développement » : un questionnaire par type de plan. Les mêmes
// définitions servent au formulaire (libellés dans messages/*.json, espace
// « Development.questions ») et à la validation du serveur (`parseAnswers`).

export const DEVELOPMENT_KINDS = [
  "physical",
  "mental",
  "social",
  "financial",
  "business",
] as const;
export type DevelopmentKind = (typeof DEVELOPMENT_KINDS)[number];

/** Pilier de chaque plan (le plan d'entreprise relève du pilier financier). */
export const KIND_PILLAR: Record<DevelopmentKind, Pillar> = {
  physical: "physical",
  mental: "mental",
  social: "social",
  financial: "financial",
  business: "financial",
};

/** Un champ n'est montré (et validé) que si un autre a l'une de ces valeurs. */
type Condition = { field: string; in: readonly string[] };

type Base = { id: string; required?: boolean; showIf?: Condition };

export type Field = Base &
  (
    | { type: "choice"; options: readonly string[]; other?: boolean }
    | { type: "multi"; options: readonly string[]; other?: boolean }
    | { type: "number"; min: number; max: number; unit?: string }
    /** Montant en dollars, entier. */
    | { type: "money"; max: number }
    /** { value, unit: "kg" | "lb" } */
    | { type: "weight" }
    /** { unit: "cm", cm } ou { unit: "ft", ft, in } */
    | { type: "height" }
    | { type: "text"; maxLength: number; multiline?: boolean }
    /** Jour à venir, AAAA-MM-JJ. */
    | { type: "date" }
    /** Note de 1 à 5. */
    | { type: "scale" }
    | { type: "yesno" }
  );

export type Section = { id: string; fields: readonly Field[] };

const OTHER_MAX = 200;
const DETAIL = { type: "text", maxLength: 500, multiline: true } as const;

/** Clé de la précision « Autre » d'un champ (ex. « mainGoalOther »). */
export const otherKey = (id: string) => `${id}Other`;

export const QUESTIONNAIRES: Record<DevelopmentKind, readonly Section[]> = {
  physical: [
    {
      id: "goal",
      fields: [
        {
          id: "fitness",
          type: "choice",
          required: true,
          options: ["beginner", "light", "regular", "athletic"],
        },
        {
          id: "mainGoal",
          type: "choice",
          required: true,
          other: true,
          options: [
            "lose_fat",
            "build_muscle",
            "get_stronger",
            "cardio",
            "health",
            "event",
          ],
        },
        { id: "targetDate", type: "date", required: true },
      ],
    },
    {
      id: "body",
      fields: [
        { id: "age", type: "number", min: 13, max: 100 },
        { id: "height", type: "height", required: true },
        { id: "weight", type: "weight", required: true },
        { id: "limitations", type: "text", maxLength: 300, multiline: true },
      ],
    },
    {
      id: "activity",
      fields: [
        { id: "sessionsNow", type: "number", min: 0, max: 14, required: true },
        {
          id: "sessionsWanted",
          type: "number",
          min: 1,
          max: 7,
          required: true,
        },
        {
          id: "sessionLength",
          type: "choice",
          required: true,
          options: ["m20", "m30", "m45", "m60", "m90"],
        },
        {
          id: "focus",
          type: "choice",
          required: true,
          options: ["cardio", "strength", "hybrid"],
        },
        {
          id: "equipment",
          type: "multi",
          required: true,
          options: ["gym", "free_weights", "bodyweight"],
        },
      ],
    },
    {
      id: "food",
      fields: [
        { id: "breakfast", type: "text", maxLength: 300, multiline: true },
        { id: "snacks", type: "text", maxLength: 300, multiline: true },
        { id: "lunch", type: "text", maxLength: 300, multiline: true },
        { id: "dinner", type: "text", maxLength: 300, multiline: true },
      ],
    },
  ],
  mental: [
    {
      id: "goal",
      fields: [
        {
          id: "mainGoal",
          type: "choice",
          required: true,
          other: true,
          options: [
            "stress",
            "discipline",
            "focus",
            "confidence",
            "sleep",
            "emotions",
          ],
        },
        // Question ouverte selon l'objectif choisi
        {
          id: "stressDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["stress"] },
        },
        {
          id: "disciplineDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["discipline"] },
        },
        {
          id: "focusDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["focus"] },
        },
        {
          id: "confidenceDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["confidence"] },
        },
        {
          id: "sleepDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["sleep"] },
        },
        {
          id: "emotionsDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["emotions"] },
        },
      ],
    },
    {
      id: "situation",
      fields: [
        {
          id: "challenges",
          type: "multi",
          required: true,
          other: true,
          options: [
            "procrastination",
            "overthinking",
            "overwhelmed",
            "screens",
            "motivation",
            "comparison",
          ],
        },
        { id: "stressLevel", type: "scale", required: true },
        { id: "sleepHours", type: "number", min: 3, max: 12, required: true },
        {
          id: "practices",
          type: "multi",
          options: ["meditation", "journaling", "sport", "reading", "therapy"],
        },
      ],
    },
    {
      id: "routine",
      fields: [
        {
          id: "minutesPerDay",
          type: "choice",
          required: true,
          options: ["m5", "m10", "m20", "m30"],
        },
        {
          id: "style",
          type: "choice",
          required: true,
          options: ["guided", "writing", "routines", "learning"],
        },
        { id: "about", ...DETAIL },
      ],
    },
  ],
  social: [
    {
      id: "goal",
      fields: [
        {
          id: "mainGoal",
          type: "choice",
          required: true,
          other: true,
          options: [
            "meet_people",
            "groups",
            "communication",
            "network",
            "relationships",
            "public_speaking",
          ],
        },
        {
          id: "meetPeopleDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["meet_people"] },
        },
        {
          id: "groupsDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["groups"] },
        },
        {
          id: "communicationDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["communication"] },
        },
        {
          id: "networkDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["network"] },
        },
        {
          id: "relationshipsDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["relationships"] },
        },
        {
          id: "publicSpeakingDetail",
          ...DETAIL,
          showIf: { field: "mainGoal", in: ["public_speaking"] },
        },
      ],
    },
    {
      id: "situation",
      fields: [
        {
          id: "personality",
          type: "choice",
          required: true,
          options: ["introvert", "ambivert", "extrovert"],
        },
        {
          id: "difficulties",
          type: "multi",
          required: true,
          other: true,
          options: [
            "start_conversation",
            "keep_conversation",
            "boundaries",
            "groups",
            "opportunities",
            "anxiety",
          ],
        },
        {
          id: "outingsPerWeek",
          type: "number",
          min: 0,
          max: 14,
          required: true,
        },
        {
          id: "contexts",
          type: "multi",
          required: true,
          options: [
            "work",
            "sport",
            "clubs",
            "networking",
            "online",
            "volunteering",
          ],
        },
      ],
    },
    {
      id: "routine",
      fields: [
        {
          id: "hoursPerWeek",
          type: "choice",
          required: true,
          options: ["h1", "h3", "h5", "h10"],
        },
        { id: "about", ...DETAIL },
      ],
    },
  ],
  financial: [
    {
      id: "career",
      fields: [
        {
          id: "career",
          type: "choice",
          required: true,
          other: true,
          options: [
            "employee",
            "employer",
            "self_employed",
            "student",
            "between_jobs",
          ],
        },
        { id: "income", type: "money", max: 10_000_000, required: true },
      ],
    },
    {
      id: "goal",
      fields: [
        { id: "mainGoal", type: "text", maxLength: 200, required: true },
        { id: "targetDate", type: "date" },
      ],
    },
    {
      id: "situation",
      fields: [
        {
          id: "monthlyExpenses",
          type: "money",
          max: 1_000_000,
          required: true,
        },
        { id: "savings", type: "money", max: 100_000_000, required: true },
        { id: "assets", type: "money", max: 100_000_000 },
        { id: "assetsDetail", type: "text", maxLength: 200 },
        { id: "belt", type: "scale", required: true },
        { id: "hasDebt", type: "yesno", required: true },
        {
          id: "debtAmount",
          type: "money",
          max: 100_000_000,
          required: true,
          showIf: { field: "hasDebt", in: ["true"] },
        },
        {
          id: "debtTypes",
          type: "multi",
          other: true,
          options: [
            "credit_card",
            "car",
            "student",
            "mortgage",
            "line_of_credit",
          ],
          showIf: { field: "hasDebt", in: ["true"] },
        },
      ],
    },
    {
      id: "business",
      fields: [
        {
          id: "business",
          type: "choice",
          required: true,
          options: ["none", "has_business", "wants_business"],
        },
      ],
    },
  ],
  business: [
    {
      id: "project",
      fields: [
        { id: "domain", type: "text", maxLength: 200, required: true },
        {
          id: "stage",
          type: "choice",
          required: true,
          options: ["idea", "validating", "first_clients", "growing"],
        },
        { id: "launchedBefore", type: "yesno", required: true },
        { id: "goal", type: "text", maxLength: 300, multiline: true },
      ],
    },
    {
      id: "means",
      fields: [
        { id: "hoursPerWeek", type: "number", min: 1, max: 80, required: true },
        { id: "budget", type: "money", max: 10_000_000 },
        { id: "location", type: "text", maxLength: 100, required: true },
      ],
    },
  ],
};

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | { value: number; unit: "kg" | "lb" }
  | { unit: "cm"; cm: number }
  | { unit: "ft"; ft: number; in: number };

export type Answers = Record<string, AnswerValue>;

/** Valeur comparée aux conditions d'affichage (booléens en « true » / « false »). */
function conditionValue(value: unknown): string[] {
  if (typeof value === "boolean") return [String(value)];
  if (typeof value === "string") return [value];
  if (Array.isArray(value))
    return value.filter((item) => typeof item === "string");
  return [];
}

/** Vrai si le champ est montré pour ces réponses. */
export function isVisible(field: Field, answers: Record<string, unknown>) {
  if (!field.showIf) return true;
  const values = conditionValue(answers[field.showIf.field]);
  return values.some((value) => field.showIf?.in.includes(value));
}

export function allFields(kind: DevelopmentKind) {
  return QUESTIONNAIRES[kind].flatMap((section) => section.fields);
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Valeur d'un champ, nettoyée ; undefined si vide, null si invalide. */
function parseValue(
  field: Field,
  raw: Record<string, unknown>,
  today: string,
): AnswerValue | undefined | null {
  const value = raw[field.id];
  if (value === undefined || value === null || value === "") return undefined;
  switch (field.type) {
    case "choice":
      return typeof value === "string" &&
        (field.options.includes(value) || (field.other && value === "other"))
        ? value
        : null;
    case "multi": {
      if (!Array.isArray(value)) return null;
      const allowed = [...field.options, ...(field.other ? ["other"] : [])];
      if (
        value.some(
          (item) => typeof item !== "string" || !allowed.includes(item),
        )
      ) {
        return null;
      }
      const unique = [...new Set(value as string[])];
      return unique.length > 0 ? unique : undefined;
    }
    case "number":
      return isNumber(value) && value >= field.min && value <= field.max
        ? Math.round(value * 10) / 10
        : null;
    case "money":
      return isNumber(value) && value >= 0 && value <= field.max
        ? Math.round(value)
        : null;
    case "weight": {
      if (typeof value !== "object" || Array.isArray(value)) return null;
      const { value: amount, unit } = value as {
        value?: unknown;
        unit?: unknown;
      };
      if (unit !== "kg" && unit !== "lb") return null;
      const [min, max] = unit === "kg" ? [25, 350] : [55, 770];
      return isNumber(amount) && amount >= min && amount <= max
        ? { value: Math.round(amount * 10) / 10, unit }
        : null;
    }
    case "height": {
      if (typeof value !== "object" || Array.isArray(value)) return null;
      const height = value as {
        unit?: unknown;
        cm?: unknown;
        ft?: unknown;
        in?: unknown;
      };
      if (height.unit === "cm") {
        return isNumber(height.cm) && height.cm >= 100 && height.cm <= 250
          ? { unit: "cm", cm: Math.round(height.cm) }
          : null;
      }
      if (height.unit === "ft") {
        const inches = isNumber(height.in) ? height.in : 0;
        return isNumber(height.ft) &&
          Number.isInteger(height.ft) &&
          height.ft >= 3 &&
          height.ft <= 8 &&
          inches >= 0 &&
          inches < 12
          ? { unit: "ft", ft: height.ft, in: Math.round(inches) }
          : null;
      }
      return null;
    }
    case "text": {
      const text = cleanText(value, field.maxLength);
      return text === "" ? undefined : text;
    }
    case "date":
      return typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
        value > today
        ? value
        : null;
    case "scale":
      return isNumber(value) &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 5
        ? value
        : null;
    case "yesno":
      return typeof value === "boolean" ? value : null;
  }
}

/**
 * Réponses revalidées par le serveur : seuls les champs montrés sont gardés,
 * les champs obligatoires sont vérifiés et les valeurs nettoyées. `today` (jour
 * de l'utilisateur) sert aux dates, qui doivent être à venir.
 */
export function parseAnswers(
  kind: DevelopmentKind,
  raw: unknown,
  today: string,
):
  | { ok: true; answers: Answers }
  | { ok: false; fields: Record<string, "required" | "invalid"> } {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const answers: Answers = {};
  const fields: Record<string, "required" | "invalid"> = {};

  for (const field of allFields(kind)) {
    // Les conditions portent sur des réponses déjà validées (champs plus haut)
    if (!isVisible(field, answers)) continue;
    const value = parseValue(field, input, today);
    if (value === null) {
      fields[field.id] = "invalid";
      continue;
    }
    if (value === undefined) {
      if (field.required) fields[field.id] = "required";
      continue;
    }
    answers[field.id] = value;
    // Précision « Autre »
    const picked = conditionValue(value);
    if ("other" in field && field.other && picked.includes("other")) {
      const other = cleanText(input[otherKey(field.id)], OTHER_MAX);
      if (other) answers[otherKey(field.id)] = other;
      else fields[otherKey(field.id)] = "required";
    }
  }

  return Object.keys(fields).length > 0
    ? { ok: false, fields }
    : { ok: true, answers };
}
