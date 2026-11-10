import { PiggyBank } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGoals } from "@/server/budget/accounts";
import { getMoneyView } from "@/server/budget/money";
import { getBudget } from "@/server/budget/service";
import { getCurrentProfile } from "@/server/profile/service";
import { EMERGENCY_MONTHS, goalProgress } from "../goals";
import { formatMoney } from "../format";
import { AccountAddButton } from "./account-dialogs";
import { BudgetProvider } from "./budget-context";
import { DebtPlanner } from "./debt-planner";
import { GoalAddButton, GoalRow } from "./goal-dialogs";

/** Budget › Objectifs : l'épargne pour ce qui compte, et le plan pour finir ses dettes. */
export async function GoalsLoader() {
  const [profile, t, format] = await Promise.all([
    getCurrentProfile(),
    getTranslations("Budget.goals"),
    getFormatter(),
  ]);
  const page = await getBudget(profile.id, { view: "month", day: null });
  const [goalRows, plan] = await Promise.all([
    loadGoals(profile.id),
    getMoneyView(profile.id, page),
  ]);
  const money = (cents: number) => formatMoney(format, cents, page.currency);
  const context = {
    categories: page.categories,
    accounts: page.accounts,
    goals: page.goals,
    today: page.today,
    currency: page.currency,
  };
  const goals = goalRows.map((goal) => ({
    goal,
    progress: goalProgress(goal, page.today),
  }));
  // Le fonds d'urgence du plan : proposé tant qu'il n'existe pas
  const emergencyCents =
    plan.emergencyGoalId === null && plan.fundCents > 0 ? plan.fundCents : null;
  const surplusCents =
    plan.plan && plan.basis.surplusCents > 0 ? plan.basis.surplusCents : null;

  return (
    <BudgetProvider value={context}>
      <div className="flex flex-col gap-6">
        <section aria-labelledby="goals-title" className="flex flex-col gap-3">
          <h2 id="goals-title" className="caps-label text-muted-foreground">
            {t("title")}
          </h2>
          {goals.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-2">
              <PiggyBank
                aria-hidden="true"
                className="size-7 text-muted-foreground"
              />
              <p className="max-w-sm text-sm text-pretty text-muted-foreground">
                {t("empty")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {goals.map(({ goal, progress }) => (
                <GoalRow key={goal.id} goal={goal} progress={progress} />
              ))}
            </ul>
          )}
          <GoalAddButton
            emergency={
              emergencyCents
                ? {
                    cents: emergencyCents,
                    hint: t("emergencyHint", {
                      months: EMERGENCY_MONTHS,
                      amount: money(emergencyCents),
                    }),
                  }
                : null
            }
          />
        </section>

        <section
          aria-labelledby="debts-title"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h2 id="debts-title" className="caps-label text-muted-foreground">
            {t("debtsTitle")}
          </h2>
          {plan.debts.length > 0 ? (
            <DebtPlanner debts={plan.debts} suggestedCents={surplusCents} />
          ) : (
            <p className="text-sm text-pretty text-muted-foreground">
              {plan.incomplete.length > 0
                ? t("debtsIncomplete")
                : t("debtsEmpty")}
            </p>
          )}
          {plan.incomplete.length > 0 && plan.debts.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("debtsMissing", {
                names: plan.incomplete.map((debt) => debt.name).join(", "),
              })}
            </p>
          ) : null}
          <AccountAddButton debt />
        </section>
      </div>
    </BudgetProvider>
  );
}

export function GoalsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-40" />
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
