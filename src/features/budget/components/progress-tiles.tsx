import { Check } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { DebtBar, GoalBar } from "@/server/budget/service";
import { displayMoney, formatMoney } from "../format";

const ACCOUNTS_PATH = "/services/financial/budget/accounts";
const GOALS_PATH = "/services/financial/budget/goals";

/** La part faite, en orange. */
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

/** Une grande carte : le nom, la barre et le détail à gauche, le chiffre à droite. */
function Tile({
  href,
  name,
  share,
  detail,
  amount,
  caption,
  done,
}: {
  href: string;
  name: string;
  share: number | null;
  detail: string;
  amount: string | null;
  caption: string;
  done: boolean;
}) {
  return (
    <Link
      href={href}
      className="col-span-2 flex items-center gap-3 rounded-2xl border border-foreground/8 bg-raised p-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-sm font-semibold">{name}</span>
        {share !== null ? <Bar share={share} /> : null}
        <span className="text-xs text-pretty text-muted-foreground tabular-nums">
          {detail}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {done || amount === null ? (
          <Check aria-hidden="true" className="size-7 text-primary" />
        ) : (
          <span className="font-display text-[1.75rem] leading-none tracking-wide whitespace-nowrap tabular-nums">
            {displayMoney(amount)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{caption}</span>
      </span>
    </Link>
  );
}

/**
 * Les dettes et les objectifs d'épargne, en grandes cartes dans la grille des
 * enveloppes (décisions du fondateur, 2026-11-10 et 2026-11-12) : ce qui reste à
 * rembourser ou à mettre de côté, et la part déjà faite.
 */
export async function ProgressTiles({
  debts,
  goals,
  currency,
}: {
  debts: DebtBar[];
  goals: GoalBar[];
  currency: string;
}) {
  const [t, tTiles, format] = await Promise.all([
    getTranslations("Budget.progress"),
    getTranslations("Budget.envelopes"),
    getFormatter(),
  ]);
  const money = (cents: number) => formatMoney(format, cents, currency);

  if (debts.length === 0 && goals.length === 0) {
    return (
      <div className="col-span-2 flex flex-col items-start gap-1 rounded-2xl border border-dashed border-foreground/15 p-3.5">
        <p className="text-sm text-pretty text-muted-foreground">
          {tTiles("progressEmpty")}
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
    );
  }

  return (
    <>
      {debts.map((debt) => {
        const paidOff = debt.owedCents === 0;
        const detail = [
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
        ]
          .filter((part): part is string => part !== null)
          .join(" · ");
        return (
          <Tile
            key={debt.id}
            href={ACCOUNTS_PATH}
            name={debt.name}
            share={debt.share}
            detail={detail}
            amount={paidOff ? null : money(debt.owedCents)}
            caption={paidOff ? t("paidOff") : tTiles("debtLeft")}
            done={paidOff}
          />
        );
      })}
      {goals.map((goal) => {
        const reached = goal.percent >= 100;
        return (
          <Tile
            key={goal.id}
            href={GOALS_PATH}
            name={goal.name}
            share={Math.min(goal.percent, 100) / 100}
            detail={t("goal", {
              saved: money(goal.savedCents),
              target: money(goal.targetCents),
            })}
            amount={
              reached
                ? null
                : money(Math.max(goal.targetCents - goal.savedCents, 0))
            }
            caption={reached ? t("reached") : tTiles("goalLeft")}
            done={reached}
          />
        );
      })}
    </>
  );
}
