import { Skeleton } from "@/components/ui/skeleton";
import type { GoalSummary } from "@/server/goals/service";
import { GoalCard } from "./goal-card";

/** Grille de cartes d'objectifs. */
export function GoalList({ goals }: { goals: GoalSummary[] }) {
  return (
    <ul className="grid sm:grid-cols-2 sm:gap-x-8">
      {goals.map((goal) => (
        <li key={goal.id} className="border-b border-foreground/8">
          <GoalCard goal={goal} />
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
