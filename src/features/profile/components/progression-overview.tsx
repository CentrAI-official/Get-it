import { getTranslations } from "next-intl/server";
import { toCalendarDay } from "@/lib/dates";
import { listGoalsInProgress } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { getRankedLevels } from "@/server/ranked/service";
import { getActiveDays, getXpTotals } from "@/server/xp/service";
import { goalPace, regularity } from "../progression";
import { GoalsInProgress } from "./goals-in-progress";
import { ProgressionSheet } from "./progression-sheet";
import { RegularitySection } from "./regularity-section";

/**
 * « Ta progression » (fiche de personnage), « Ta régularité » et « Tes
 * objectifs en cours ». Lit la session : à placer dans un <Suspense>.
 */
export async function ProgressionOverview() {
  const profile = await getCurrentProfile();
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const [xp, ranked, activeDays, goals, t] = await Promise.all([
    getXpTotals(profile.id),
    getRankedLevels(profile.id),
    getActiveDays(profile.id),
    listGoalsInProgress(profile.id, profile.timeZone),
    getTranslations("Progress"),
  ]);

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
            {ranked ? t("descriptionRanked") : t("description")}
          </p>
        </div>
        <ProgressionSheet
          total={xp.total}
          pillars={xp.pillars}
          ranked={ranked}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <RegularitySection
          regularity={regularity(
            activeDays,
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
