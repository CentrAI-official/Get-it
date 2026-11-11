import { Check } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { DebtBar, GoalBar } from "@/server/budget/service";
import { formatMoney } from "../format";

const ACCOUNTS_PATH = "/services/financial/budget/accounts";
const GOALS_PATH = "/services/financial/budget/goals";

/** Une barre de progrès : la part faite, en orange. */
function Bar({ share }: { share: number }) {
  return (
    <span
      aria-hidden="true"
      className="block h-2 overflow-hidden rounded-full bg-foreground/8"
    >
      <span
        className="block h-full rounded-full bg-primary"
        style={{ width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%` }}
      />
    </span>
  );
}

function Row({
  href,
  name,
  amount,
  share,
  detail,
  done,
}: {
  href: string;
  name: string;
  amount: string;
  share: number | null;
  detail: string;
  done: boolean;
}) {
  return (
    <li className="border-b border-foreground/8 last:border-b-0">
      <Link
        href={href}
        className="flex flex-col gap-1.5 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums",
              done && "text-primary",
            )}
          >
            {done ? <Check aria-hidden="true" className="size-4" /> : null}
            {amount}
          </span>
        </span>
        {share !== null ? <Bar share={share} /> : null}
        <span className="text-xs text-muted-foreground tabular-nums">
          {detail}
        </span>
      </Link>
    </li>
  );
}

/**
 * « Dettes et épargne » (décision du fondateur, 2026-11-10) : où en est chaque
 * dette (ce qui est remboursé depuis son ajout) et chaque objectif d'épargne.
 * Les barres vivent ici ; les paiements fixes, eux, se cochent.
 */
export async function ProgressSection({
  debts,
  goals,
  currency,
}: {
  debts: DebtBar[];
  goals: GoalBar[];
  currency: string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("Budget.progress"),
    getFormatter(),
  ]);
  const money = (cents: number) => formatMoney(format, cents, currency);

  return (
    <section
      aria-labelledby="budget-progress"
      className="flex flex-col gap-1 border-t border-foreground/8 pt-6"
    >
      <h2 id="budget-progress" className="caps-label text-muted-foreground">
        {t("title")}
      </h2>
      {debts.length === 0 && goals.length === 0 ? (
        <div className="flex flex-col items-start gap-1 pt-1">
          <p className="text-sm text-pretty text-muted-foreground">
            {t("empty")}
          </p>
          <div className="flex flex-wrap gap-x-4">
            {(
              [
                [ACCOUNTS_PATH, t("addDebt")],
                [GOALS_PATH, t("addGoal")],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-11 items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col">
          {debts.map((debt) => {
            const paidOff = debt.owedCents === 0;
            const parts = [
              debt.share !== null
                ? t("repaid", { percent: Math.floor(debt.share * 100) })
                : null,
              !paidOff && debt.minimumCents
                ? debt.paymentDay
                  ? t("minimum", {
                      amount: money(debt.minimumCents),
                      day: debt.paymentDay,
                    })
                  : t("minimumOnly", { amount: money(debt.minimumCents) })
                : null,
            ].filter((part): part is string => part !== null);
            return (
              <Row
                key={debt.id}
                href={ACCOUNTS_PATH}
                name={debt.name}
                amount={
                  paidOff
                    ? t("paidOff")
                    : t("owed", { amount: money(debt.owedCents) })
                }
                share={debt.share}
                detail={parts.join(" · ")}
                done={paidOff}
              />
            );
          })}
          {goals.map((goal) => (
            <Row
              key={goal.id}
              href={GOALS_PATH}
              name={goal.name}
              amount={t("goal", {
                saved: money(goal.savedCents),
                target: money(goal.targetCents),
              })}
              share={Math.min(goal.percent, 100) / 100}
              detail={
                goal.percent >= 100
                  ? t("reached")
                  : t("percent", { percent: goal.percent })
              }
              done={goal.percent >= 100}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
