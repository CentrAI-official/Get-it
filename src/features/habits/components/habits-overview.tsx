import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import { toCalendarDay } from "@/lib/dates";
import { listHabits } from "@/server/habits/service";
import { getCurrentProfile } from "@/server/profile/service";
import { HabitCard } from "./habit-card";
import { ArchiveButton } from "./habit-manage";
import { NoHabits } from "./no-habits";

/** Habitudes en cours (à cocher) et en pause. Lit la session : à placer dans un <Suspense>. */
export async function HabitsOverview() {
  const profile = await getCurrentProfile();
  const [habits, t, tPillars] = await Promise.all([
    listHabits(profile.id, profile.timeZone),
    getTranslations("Habits"),
    getTranslations("Pillars"),
  ]);
  if (habits.length === 0) return <NoHabits />;

  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const active = habits.filter((habit) => !habit.archived);
  const archived = habits.filter((habit) => habit.archived);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="habits-active" className="flex flex-col gap-4">
        <h2 id="habits-active" className="font-heading text-lg font-bold">
          {t("sections.active")}
        </h2>
        {active.length > 0 ? (
          <ul className="grid md:grid-cols-2 md:gap-x-8">
            {active.map((habit) => (
              <li key={habit.id}>
                <HabitCard habit={habit} today={today} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noActive")}</p>
        )}
      </section>

      {archived.length > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md font-heading text-lg font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
            />
            {t("sections.archived", { count: archived.length })}
          </summary>
          <ul className="mt-2 flex flex-col">
            {archived.map((habit) => {
              const Icon = pillarIcons[habit.pillar];
              return (
                <li
                  key={habit.id}
                  className="flex flex-wrap items-center gap-3 border-b border-white/8 py-3"
                >
                  <Icon aria-hidden="true" className="size-4 text-silver" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">
                      {habit.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tPillars(`${habit.pillar}.name`)}
                    </p>
                  </div>
                  <ArchiveButton
                    habitId={habit.id}
                    archived={false}
                    label={t("resume")}
                    variant="ghost"
                  />
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function HabitsOverviewSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-[230px] rounded-3xl" />
      ))}
    </div>
  );
}
