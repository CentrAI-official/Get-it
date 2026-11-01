import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { DayKey } from "@/features/analytics/metrics";
import { DASHBOARD_TIME_ZONE } from "@/features/analytics/rules";
import { addDays, toCalendarDay } from "@/lib/dates";
import { getServerEnv } from "@/server/env";

// Morceaux de SQL et de dates partagés par les lectures du dashboard. Les
// comptes de l'équipe (rôle admin) et ceux marqués « exclus » ne comptent pas ;
// les événements mesurés viennent seulement de l'environnement de ce
// déploiement (la base est partagée avec le développement pendant la bêta).

const TZ = DASHBOARD_TIME_ZONE;

/** Personnes comptées dans les statistiques. */
export const PEOPLE = Prisma.sql`SELECT id FROM profiles WHERE role <> 'admin' AND NOT analytics_excluded`;

/** Jour du dashboard d'une colonne de date, en « AAAA-MM-JJ ». */
export const dayOf = (column: Prisma.Sql) =>
  Prisma.sql`to_char((${column} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD')`;

export const todayKey = (now: Date): DayKey => toCalendarDay(now, TZ);

/** Début approximatif (un jour de marge) des `days` derniers jours : sert à l'index. */
export function sinceDays(now: Date, days: number) {
  return new Date(now.getTime() - (days + 1) * 86_400_000);
}

/** La date tombe-t-elle entre le premier jour de la période et aujourd'hui (fuseau du dashboard) ? */
export const inPeriod = (column: Prisma.Sql, firstDay: DayKey) =>
  Prisma.sql`(${column} AT TIME ZONE ${TZ})::date >= ${firstDay}::date`;

/** Premier jour d'une période de `period` jours qui finit aujourd'hui. */
export const firstDayOf = (today: DayKey, period: number) =>
  addDays(today, -(period - 1));

/** Environnement de ce déploiement (development, preview, production). */
export const env = () => getServerEnv().VERCEL_ENV;

export const toNumber = (value: bigint | number | null) => Number(value ?? 0);
