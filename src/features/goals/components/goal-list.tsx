import { Skeleton } from "@/components/ui/skeleton";
import type { GoalSummary } from "@/server/goals/service";
import { GoalCard } from "./goal-card";

/** Grille de cartes d'objectifs, avec la série de semaines de chacun (`streaks`). */
export function GoalList({
  goals,
  streaks,
}: {
  goals: GoalSummary[];
  streaks?: ReadonlyMap<string, number>;
}) {
  return (
    <ul className="grid sm:grid-cols-2 sm:gap-x-8">
      {goals.map((goal) => (
        <li key={goal.id} className="border-b border-foreground/8">
          <GoalCard goal={goal} weekStreak={streaks?.get(goal.id) ?? 0} />
        </li>
      ))}
    </ul>
  );
}

export function GoalListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-[90px] rounded-3xl" />
      ))}
    </div>
  );
}
