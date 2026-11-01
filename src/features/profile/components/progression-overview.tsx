import { getTranslations } from "next-intl/server";
import { PILLARS, type Pillar } from "@/config/pillars";
import { dayStreak } from "@/features/streaks/rules";
import { lastDays, toCalendarDay } from "@/lib/dates";
import { listGoalsInProgress } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { getMyLevels } from "@/server/levels/service";
import { getActivity } from "@/server/streaks/service";
import { goalPace, regularity } from "../progression";
import { GoalsInProgress } from "./goals-in-progress";
import {
  ProgressionSheet,
  SHEET_SEGMENTS,
  type PillarStreak,
} from "./progression-sheet";
import { RegularitySection } from "./regularity-section";

/**
 * « Ta progression » (fiche de personnage), « Ta régularité » et « Tes
 * objectifs en cours ». Lit la session : à placer dans un <Suspense>.
 */
export async function ProgressionOverview() {
  const profile = await getCurrentProfile();
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const [levels, activity, goals, t] = await Promise.all([
    getMyLevels(profile.id),
    getActivity(profile.id, profile.timeZone),
    listGoalsInProgress(profile.id, profile.timeZone),
    getTranslations("Progress"),
  ]);
  const recentDays = lastDays(today, SHEET_SEGMENTS);
  const streaks = Object.fromEntries(
    PILLARS.map((pillar): [Pillar, PillarStreak] => {
      const days = activity.pillars[pillar];
      const active = new Set(days);
      return [
        pillar,
        {
          days: dayStreak(days, today).current,
          recent: recentDays.map((day) => active.has(day)),
        },
      ];
    }),
  ) as Record<Pillar, PillarStreak>;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="progression-title"
        className="flex flex-col gap-5 border-t border-foreground/8 pt-6"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="progression-title"
            className="caps-label text-muted-foreground"
          >
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {levels.ranked ? t("descriptionRanked") : t("description")}
          </p>
        </div>
        <ProgressionSheet levels={levels} streaks={streaks} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <RegularitySection
          regularity={regularity(
            activity.days,
            today,
            toCalendarDay(profile.createdAt, profile.timeZone),
          )}
        />
        <GoalsInProgress
          goals={goals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            targetDate: goal.targetDate,
            pace: goalPace({ ...goal, today }),
          }))}
        />
      </div>
    </div>
  );
}
