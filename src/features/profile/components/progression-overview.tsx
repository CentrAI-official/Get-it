import { getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/progress-ring";
import { PILLARS, pillarIcons } from "@/config/pillars";
import { XpHistoryChart } from "@/features/xp/components/xp-history-chart";
import { levelFromXp } from "@/features/xp/rules";
import { lastDays, toCalendarDay } from "@/lib/dates";
import { listCheckIns } from "@/server/check-ins/service";
import { getCurrentProfile } from "@/server/profile/service";
import { getXpByDay, getXpTotals } from "@/server/xp/service";
import { CheckInTrends } from "./check-in-trends";

/** Jours montrés dans les graphiques de progression. */
const HISTORY_DAYS = 14;

/**
 * Niveau de chaque pilier, XP des 14 derniers jours et évolution des
 * check-ins. Lit la session : à placer dans un <Suspense>.
 */
export async function ProgressionOverview() {
  const profile = await getCurrentProfile();
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const days = lastDays(today, HISTORY_DAYS);
  const from = days[0] ?? today;
  const [xp, xpByDay, checkIns, t, tXp, tPillars] = await Promise.all([
    getXpTotals(profile.id),
    getXpByDay(profile.id, from, today),
    listCheckIns(profile.id, from, today),
    getTranslations("Progress"),
    getTranslations("Xp"),
    getTranslations("Pillars"),
  ]);
  const checkInByDay = new Map(checkIns.map((item) => [item.day, item]));

  return (
    <section
      aria-labelledby="progression-title"
      className="flex flex-col gap-6 border-t border-white/8 pt-6"
    >
      <h2 id="progression-title" className="font-heading text-lg font-bold">
        {t("title")}
      </h2>

      <section
        aria-labelledby="pillar-levels-title"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h3 id="pillar-levels-title" className="font-heading font-bold">
            {t("pillarsTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("pillarsDescription")}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {PILLARS.map((pillar) => {
            const Icon = pillarIcons[pillar];
            const level = levelFromXp(xp.pillars[pillar]);
            return (
              <li
                key={pillar}
                className="flex flex-col items-center gap-2 text-center"
              >
                <ProgressRing value={level.progress} className="size-16 p-1">
                  <span className="flex flex-col items-center leading-none">
                    <Icon aria-hidden="true" className="size-3.5 text-silver" />
                    <span className="font-mono text-lg font-bold">
                      {level.level}
                    </span>
                  </span>
                </ProgressRing>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {tPillars(`${pillar}.name`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tXp("level", { level: level.level })} ·{" "}
                    {tXp("xp", { xp: xp.pillars[pillar] })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
        <XpHistoryChart
          days={days.map((day) => ({ day, xp: xpByDay.get(day) ?? 0 }))}
        />
        <CheckInTrends
          days={days.map((day) => {
            const checkIn = checkInByDay.get(day);
            return {
              day,
              scores: checkIn
                ? {
                    mood: checkIn.mood,
                    energy: checkIn.energy,
                    stress: checkIn.stress,
                    sleep: checkIn.sleep,
                  }
                : null,
            };
          })}
        />
      </div>
    </section>
  );
}
