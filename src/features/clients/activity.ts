import { addDays, daysBetween } from "@/lib/dates";
import type { ShareableKind } from "./rules";

// Le suivi des clients d'une page pro (décision du fondateur, 2026-11-10 : la
// liste de la maquette « Liste pro », et le résumé de la maquette « Cette
// semaine » en haut de la fiche d'un client). Ce que le client a fait de ses
// plans partagés, les 7 derniers jours dans son fuseau. Jamais son journal, ses
// check-ins ni un montant du budget. Fonctions pures.

/** La fenêtre du suivi : les 7 derniers jours, aujourd'hui compris. */
export const ACTIVITY_DAYS = 7;
/** Rien de fait depuis ce nombre de jours alors que c'était prévu : à relancer. */
export const NUDGE_DAYS = 5;
/** Une modification acceptée par le client reste signalée ce nombre de jours. */
export const ACCEPTED_FLAG_DAYS = 7;

/** Les 7 derniers jours, du plus ancien à aujourd'hui. */
export function activityDays(today: string): string[] {
  return Array.from({ length: ACTIVITY_DAYS }, (_, index) =>
    addDays(today, index - ACTIVITY_DAYS + 1),
  );
}

export type DayActivity = {
  day: string;
  /** Les éléments prévus ce jour-là (une séance d'entraînement compte pour un). */
  planned: number;
  /** Ceux qui sont faits (jamais plus que prévu). */
  done: number;
  /** Au moins une chose faite, prévue ou non (une séance un jour de repos). */
  active: boolean;
};

/**
 * Un plan, un jour : chaque élément coché compte pour un élément prévu ;
 * l'entraînement compte une séance terminée pour la séance prévue (il se note
 * dans le carnet, pas exercice par exercice).
 */
export function planDay({
  kind,
  items,
  logged,
  workout,
}: {
  kind: ShareableKind;
  /** Les éléments de la séance prévue ce jour-là (0 : rien de prévu). */
  items: number;
  /** Les éléments cochés ce jour-là. */
  logged: number;
  /** Entraînement : une séance terminée ce jour-là. */
  workout: boolean;
}): Omit<DayActivity, "day"> {
  if (kind === "physical") {
    const planned = items > 0 ? 1 : 0;
    return { planned, done: workout ? planned : 0, active: workout };
  }
  return {
    planned: items,
    done: Math.min(logged, items),
    active: logged > 0,
  };
}

/** Plusieurs plans, le même jour. */
export function combineDay(
  day: string,
  parts: readonly Omit<DayActivity, "day">[],
): DayActivity {
  return {
    day,
    planned: parts.reduce((sum, part) => sum + part.planned, 0),
    done: parts.reduce((sum, part) => sum + part.done, 0),
    active: parts.some((part) => part.active),
  };
}

export type ActivitySummary = {
  days: DayActivity[];
  /** Jours où au moins une chose a été faite. */
  activeDays: number;
  /** Jours où quelque chose était prévu. */
  plannedDays: number;
  /** Jours où tout ce qui était prévu est fait. */
  fullDays: number;
  planned: number;
  done: number;
  /** La part faite, de 0 à 100 ; null si rien n'était prévu. */
  percent: number | null;
};

export function summarizeActivity(
  days: readonly DayActivity[],
): ActivitySummary {
  const planned = days.reduce((sum, day) => sum + day.planned, 0);
  const done = days.reduce((sum, day) => sum + day.done, 0);
  return {
    days: [...days],
    activeDays: days.filter((day) => day.active).length,
    plannedDays: days.filter((day) => day.planned > 0).length,
    fullDays: days.filter((day) => day.planned > 0 && day.done >= day.planned)
      .length,
    planned,
    done,
    percent: planned > 0 ? Math.round((done / planned) * 100) : null,
  };
}

/**
 * À relancer : quelque chose était prévu ces jours-ci, mais rien n'a été fait
 * depuis 5 jours. Jamais un client suivi depuis moins de 5 jours.
 */
export function needsNudge({
  summary,
  lastActiveDay,
  sinceDay,
  today,
}: {
  summary: Pick<ActivitySummary, "planned">;
  /** Le dernier jour où il a fait quelque chose de ses plans partagés. */
  lastActiveDay: string | null;
  /** Le début du suivi. */
  sinceDay: string;
  today: string;
}): boolean {
  if (summary.planned === 0) return false;
  if (daysBetween(sinceDay, today) < NUDGE_DAYS) return false;
  return (
    lastActiveDay === null || daysBetween(lastActiveDay, today) >= NUDGE_DAYS
  );
}

export const CLIENT_FLAGS = ["nudge", "pending", "accepted"] as const;
export type ClientFlag = (typeof CLIENT_FLAGS)[number];

/** Le signal d'une ligne : à relancer d'abord, puis une modification en attente, puis acceptée. */
export function clientFlag({
  nudge,
  pendingProposal,
  acceptedRecently,
}: {
  nudge: boolean;
  pendingProposal: boolean;
  acceptedRecently: boolean;
}): ClientFlag | null {
  if (nudge) return "nudge";
  if (pendingProposal) return "pending";
  if (acceptedRecently) return "accepted";
  return null;
}

const HOUR_MS = 60 * 60 * 1000;

/** « il y a 3 min », « il y a 2 h », « hier », « il y a 9 jours » : la clé et le nombre. */
export function lastActiveLabel(
  lastActiveAt: string | null,
  now: number,
): {
  key: "never" | "minutes" | "hours" | "yesterday" | "days";
  count: number;
} {
  if (lastActiveAt === null) return { key: "never", count: 0 };
  const elapsed = Math.max(0, now - new Date(lastActiveAt).getTime());
  if (elapsed < HOUR_MS) {
    return { key: "minutes", count: Math.max(1, Math.floor(elapsed / 60_000)) };
  }
  if (elapsed < 24 * HOUR_MS) {
    return { key: "hours", count: Math.floor(elapsed / HOUR_MS) };
  }
  if (elapsed < 48 * HOUR_MS) return { key: "yesterday", count: 1 };
  return { key: "days", count: Math.floor(elapsed / (24 * HOUR_MS)) };
}

export const CLIENT_SORTS = ["recent", "nudge", "name"] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];

type SortableRow = {
  name: string;
  lastActiveAt: string | null;
  flag: ClientFlag | null;
  percent: number | null;
};

const byName = (a: SortableRow, b: SortableRow) =>
  a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

/** Activité récente (rien encore : à la fin), à relancer d'abord, ou par nom. */
export function sortClients<Row extends SortableRow>(
  rows: readonly Row[],
  sort: ClientSort,
): Row[] {
  const recent = (a: Row, b: Row) =>
    (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "") || byName(a, b);
  return [...rows].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "nudge") {
      const nudged = Number(b.flag === "nudge") - Number(a.flag === "nudge");
      if (nudged !== 0) return nudged;
      // Puis ceux qui en font le moins
      const share = (a.percent ?? 101) - (b.percent ?? 101);
      if (share !== 0) return share;
    }
    return recent(a, b);
  });
}

/** Sans majuscules ni accents : « emilie » trouve « Émilie Côté ». */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** La recherche d'un client, par son nom ou son nom d'utilisateur. */
export function matchesClient(
  person: { displayName: string | null; username: string | null },
  query: string,
): boolean {
  const wanted = fold(query.replace(/^@/, ""));
  if (!wanted) return true;
  return [person.displayName, person.username].some(
    (value) => value !== null && fold(value).includes(wanted),
  );
}
