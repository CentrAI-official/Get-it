import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons, type Pillar } from "@/config/pillars";

type GoalListProps = {
  goals: { id: string; title: string; pillar: Pillar }[];
};

/** Liste compacte d'objectifs avec leur pilier. */
export function GoalList({ goals }: GoalListProps) {
  const t = useTranslations("Pillars");

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {goals.map((goal) => {
        const Icon = pillarIcons[goal.pillar];
        return (
          <li
            key={goal.id}
            className="flex items-center gap-4 rounded-xl border bg-card p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-silver">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-pretty break-words">
                {goal.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`${goal.pillar}.name`)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function GoalListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-[74px] rounded-xl" />
      ))}
    </div>
  );
}
