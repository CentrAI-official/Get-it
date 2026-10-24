import { getTranslations } from "next-intl/server";
import { XpHistoryChart } from "@/features/xp/components/xp-history-chart";
import { lastDays, toCalendarDay } from "@/lib/dates";
import { getCurrentProfile } from "@/server/profile/service";
import { getXpByDay, getXpTotals } from "@/server/xp/service";
import { ProgressionOrbit } from "./progression-orbit";

/** Jours montrés dans le graphique de l'XP. */
const HISTORY_DAYS = 14;

/**
 * « Ta progression » : chaque pilier vers son prochain niveau (orbite) et l'XP
 * des 14 derniers jours. Lit la session : à placer dans un <Suspense>.
 */
export async function ProgressionOverview() {
  const profile = await getCurrentProfile();
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const days = lastDays(today, HISTORY_DAYS);
  const from = days[0] ?? today;
  const [xp, xpByDay, t] = await Promise.all([
    getXpTotals(profile.id),
    getXpByDay(profile.id, from, today),
    getTranslations("Progress"),
  ]);

  return (
    <section
      aria-labelledby="progression-title"
      className="flex flex-col gap-6 border-t border-white/8 pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="progression-title" className="font-heading text-lg font-bold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10">
        <ProgressionOrbit total={xp.total} pillars={xp.pillars} />
        <XpHistoryChart
          days={days.map((day) => ({ day, xp: xpByDay.get(day) ?? 0 }))}
        />
      </div>
    </section>
  );
}
