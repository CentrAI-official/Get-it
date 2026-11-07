import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { DevelopmentSection } from "@/features/development/components/development-section";
import { BudgetTabs, type BudgetTabKey } from "./budget-tabs";

/** Une page du budget : l'en-tête de Financier, puis les onglets du budget. */
export function BudgetSection({
  current,
  children,
}: {
  current: BudgetTabKey;
  children: ReactNode;
}) {
  const t = useTranslations("Budget.tabs");
  return (
    <DevelopmentSection section="financial" current="budget">
      <BudgetTabs
        current={current}
        label={t("label")}
        labels={{
          month: t("month"),
          transactions: t("transactions"),
          bills: t("bills"),
          accounts: t("accounts"),
          goals: t("goals"),
          reports: t("reports"),
        }}
      />
      {children}
    </DevelopmentSection>
  );
}
