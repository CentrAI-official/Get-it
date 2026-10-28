import { z } from "zod";
import { addDays, daysBetween } from "@/lib/dates";

// Pactes (lot M2) : défi à deux dans une conversation. Chacun relie une de
// ses habitudes ; seul son « fait / pas fait » est partagé. Pas d'XP en plus :
// l'habitude en rapporte déjà.

export const PACT_DURATIONS = [7, 14, 30] as const;
export const PACT_RULES = ["daily", "most"] as const;
export type PactRule = (typeof PACT_RULES)[number];
export const PACT_TITLE_MAX_LENGTH = 60;
/** Propositions de pacte par 24 heures. */
export const DAILY_PACT_PROPOSALS = 10;
/** Part des jours à faire avec la règle « 80 % des jours ». */
export const PACT_MOST_SHARE = 0.8;

/** Jours que chacun doit faire pour réussir le pacte. */
export function pactNeed(days: number, rule: PactRule) {
  return rule === "daily" ? days : Math.ceil(days * PACT_MOST_SHARE);
}

export const pactProposalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "titleRequired" })
    .max(PACT_TITLE_MAX_LENGTH, { error: "titleTooLong" }),
  days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  rule: z.enum(PACT_RULES),
  habitId: z.uuid({ error: "habitRequired" }),
});

export type PactProposal = z.infer<typeof pactProposalSchema>;

export const PACT_ERRORS = [
  "pactOpen",
  "pactLimit",
  "habitRequired",
  "titleRequired",
  "titleTooLong",
] as const;

export type PactError = (typeof PACT_ERRORS)[number];

export const pactResponseSchema = z.discriminatedUnion("accept", [
  z.object({ accept: z.literal(false) }),
  z.object({
    accept: z.literal(true),
    habit: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("existing"), id: z.uuid() }),
      z.object({ kind: z.literal("new") }),
    ]),
  }),
]);

export type PactResponse = z.infer<typeof pactResponseSchema>;

export type PactCell = {
  /** « AAAA-MM-JJ » */
  day: string;
  me: boolean;
  them: boolean;
  state: "past" | "today" | "future";
};

/**
 * Avancement d'un pacte, vu par un participant : ses jours faits (`mine`) et
 * ceux de l'autre (`theirs`), comptés jusqu'à aujourd'hui. Aujourd'hui pas
 * encore fait ne casse pas la série commune.
 */
export function pactProgress({
  startsOn,
  days,
  today,
  mine,
  theirs,
}: {
  startsOn: string;
  days: number;
  today: string;
  mine: ReadonlySet<string>;
  theirs: ReadonlySet<string>;
}) {
  const cells: PactCell[] = Array.from({ length: days }, (_, index) => {
    const day = addDays(startsOn, index);
    return {
      day,
      me: mine.has(day),
      them: theirs.has(day),
      state: day < today ? "past" : day === today ? "today" : "future",
    };
  });
  const elapsed = cells.filter((cell) => cell.state !== "future");
  let streak = 0;
  for (let index = elapsed.length - 1; index >= 0; index -= 1) {
    const cell = elapsed[index];
    if (!cell) break;
    if (cell.me && cell.them) streak += 1;
    else if (cell.state !== "today") break;
  }
  const todayCell = cells.find((cell) => cell.state === "today");
  return {
    cells,
    /** Jour du pacte (1 au premier jour), 0 avant le début. */
    dayIndex: Math.min(days, Math.max(0, daysBetween(startsOn, today) + 1)),
    together: elapsed.filter((cell) => cell.me && cell.them).length,
    mineCount: elapsed.filter((cell) => cell.me).length,
    theirsCount: elapsed.filter((cell) => cell.them).length,
    streak,
    meToday: todayCell?.me ?? false,
    themToday: todayCell?.them ?? false,
  };
}

/** Résultat d'un pacte terminé : réussi si chacun a fait assez de jours. */
export function pactOutcome({
  need,
  mineCount,
  theirsCount,
}: {
  need: number;
  mineCount: number;
  theirsCount: number;
}): "success" | "failed" {
  return mineCount >= need && theirsCount >= need ? "success" : "failed";
}

// Pactes de groupe (discussion d'un groupe privé) : chacun relie sa propre
// habitude ; le pacte commence avec ceux qui l'acceptent (2 au moins).

/** Part des participants qui doivent réussir pour que le pacte de groupe réussisse. */
export const PACT_GROUP_SHARE = 0.8;
/** Participants au moins (celui qui propose compris). */
export const PACT_GROUP_MIN = 2;

/**
 * Avancement d'un pacte de groupe jusqu'à `today` : pour chaque participant,
 * les jours faits pendant le pacte et s'il a fait sa part aujourd'hui.
 */
export function groupPactProgress({
  startsOn,
  days,
  today,
  members,
}: {
  startsOn: string;
  days: number;
  today: string;
  members: readonly { id: string; done: ReadonlySet<string> }[];
}) {
  const endsOn = addDays(startsOn, days - 1);
  const last = today < endsOn ? today : endsOn;
  return {
    /** Jour du pacte (1 au premier jour), 0 avant le début. */
    dayIndex: Math.min(days, Math.max(0, daysBetween(startsOn, today) + 1)),
    members: members.map((member) => ({
      id: member.id,
      count: [...member.done].filter((day) => day >= startsOn && day <= last)
        .length,
      today: today >= startsOn && today <= endsOn && member.done.has(today),
    })),
  };
}

/**
 * Résultat d'un pacte de groupe terminé : réussi si au moins 80 % des
 * participants ont fait assez de jours (et qu'ils étaient au moins deux).
 */
export function groupPactOutcome(
  need: number,
  counts: readonly number[],
): "success" | "failed" {
  if (counts.length < PACT_GROUP_MIN) return "failed";
  const succeeded = counts.filter((count) => count >= need).length;
  return succeeded >= Math.ceil(PACT_GROUP_SHARE * counts.length)
    ? "success"
    : "failed";
}
