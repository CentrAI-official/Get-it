import { z } from "zod";
import {
  DEVELOPMENT_PLAN_LIMITS,
  SESSION_TITLE_MAX_LENGTH,
  type DevelopmentPlan,
} from "@/features/development/plan";

// Modifications de plan proposées par une page pro (lot 4, décision du
// fondateur 2026-11-07) : le pro modifie la semaine type d'un plan que son
// client lui montre ; rien ne change avant que le client accepte. Fonctions
// pures, alignées sur la migration 20261123120000_plan_proposals.

export type Schedule = DevelopmentPlan["schedule"];
type ScheduleItem = Schedule[number]["items"][number];

export const PROPOSAL_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
  "outdated",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_LIMITS = {
  /** Le mot du pro. */
  note: 500,
  itemName: 100,
  itemDetail: 200,
  /** Propositions envoyées par une page en 24 h. */
  perDay: 30,
} as const;

export const PROPOSAL_ERRORS = [
  "notFound",
  "noChange",
  "outdated",
  "proposalLimit",
  "noteTooLong",
  "sessionInvalid",
  "unexpected",
] as const;
export type ProposalError = (typeof PROPOSAL_ERRORS)[number];

const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "sessionInvalid")
    .max(PROPOSAL_LIMITS.itemName, "sessionInvalid"),
  detail: z.string().trim().max(PROPOSAL_LIMITS.itemDetail, "sessionInvalid"),
});

/** Ce que le pro envoie : la semaine type modifiée, un jour par séance. */
export const scheduleEditSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(1).max(7),
      title: z
        .string()
        .trim()
        .min(1, "sessionInvalid")
        .max(SESSION_TITLE_MAX_LENGTH, "sessionInvalid"),
      items: z
        .array(itemSchema)
        .min(1, "sessionInvalid")
        .max(DEVELOPMENT_PLAN_LIMITS.itemsPerDay, "sessionInvalid"),
    }),
  )
  .max(DEVELOPMENT_PLAN_LIMITS.scheduleDays, "sessionInvalid")
  .refine(
    (days) => new Set(days.map((day) => day.weekday)).size === days.length,
    { message: "sessionInvalid" },
  );
export type ScheduleEdit = z.output<typeof scheduleEditSchema>;

export const proposalNoteSchema = z
  .string()
  .trim()
  .max(PROPOSAL_LIMITS.note, "noteTooLong");

const nameKey = (name: string) => name.trim().toLocaleLowerCase();

/**
 * La semaine proposée : pour un jour qui existe déjà, son moment et son heure
 * (choisis par le client) sont gardés ; un élément qui garde son nom garde sa
 * fiche du catalogue.
 */
export function buildProposedSchedule(
  current: Schedule,
  edit: ScheduleEdit,
): Schedule {
  const refs = new Map(
    current.flatMap((day) =>
      day.items.flatMap((item) =>
        item.ref ? [[nameKey(item.name), item.ref] as const] : [],
      ),
    ),
  );
  return [...edit]
    .sort((a, b) => a.weekday - b.weekday)
    .map((day) => {
      const existing = current.find((entry) => entry.weekday === day.weekday);
      return {
        weekday: day.weekday,
        moment: existing?.moment ?? null,
        time: existing?.time ?? null,
        title: day.title,
        items: day.items.map((item) => ({
          name: item.name,
          detail: item.detail,
          ref: refs.get(nameKey(item.name)) ?? null,
        })),
      };
    });
}

/** Forme comparable d'une semaine (ordre des jours, champs utiles seulement). */
function comparable(schedule: Schedule) {
  return JSON.stringify(
    [...schedule]
      .sort((a, b) => a.weekday - b.weekday)
      .map((day) => [
        day.weekday,
        day.title,
        day.moment ?? null,
        day.time ?? null,
        day.items.map((item) => [item.name, item.detail, item.ref ?? null]),
      ]),
  );
}

/** Deux semaines identiques (le plan n'a pas changé entre-temps). */
export function sameSchedule(a: Schedule, b: Schedule) {
  return comparable(a) === comparable(b);
}

export type DayChange = {
  weekday: number;
  status: "added" | "removed" | "changed";
  titleBefore: string | null;
  titleAfter: string | null;
  added: ScheduleItem[];
  removed: ScheduleItem[];
  changed: { before: ScheduleItem; after: ScheduleItem }[];
};

/**
 * Ce qui change, jour par jour, pour que le client sache ce qu'il accepte :
 * séance ajoutée ou retirée, titre, éléments ajoutés, retirés ou précisés.
 */
export function scheduleDiff(before: Schedule, after: Schedule): DayChange[] {
  const changes: DayChange[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const old = before.find((day) => day.weekday === weekday) ?? null;
    const next = after.find((day) => day.weekday === weekday) ?? null;
    if (!old && !next) continue;
    if (!old && next) {
      changes.push({
        weekday,
        status: "added",
        titleBefore: null,
        titleAfter: next.title,
        added: next.items,
        removed: [],
        changed: [],
      });
      continue;
    }
    if (old && !next) {
      changes.push({
        weekday,
        status: "removed",
        titleBefore: old.title,
        titleAfter: null,
        added: [],
        removed: old.items,
        changed: [],
      });
      continue;
    }
    if (!old || !next) continue;
    const oldByName = new Map(
      old.items.map((item) => [nameKey(item.name), item]),
    );
    const nextByName = new Map(
      next.items.map((item) => [nameKey(item.name), item]),
    );
    const added = next.items.filter(
      (item) => !oldByName.has(nameKey(item.name)),
    );
    const removed = old.items.filter(
      (item) => !nextByName.has(nameKey(item.name)),
    );
    const changed = next.items.flatMap((item) => {
      const previous = oldByName.get(nameKey(item.name));
      return previous && previous.detail !== item.detail
        ? [{ before: previous, after: item }]
        : [];
    });
    if (
      old.title !== next.title ||
      added.length > 0 ||
      removed.length > 0 ||
      changed.length > 0
    ) {
      changes.push({
        weekday,
        status: "changed",
        titleBefore: old.title,
        titleAfter: next.title,
        added,
        removed,
        changed,
      });
    }
  }
  return changes;
}

/** Première erreur connue d'une validation, sinon « unexpected ». */
export function firstProposalError(error: z.ZodError): ProposalError {
  const message = error.issues[0]?.message;
  return PROPOSAL_ERRORS.find((key) => key === message) ?? "sessionInvalid";
}
