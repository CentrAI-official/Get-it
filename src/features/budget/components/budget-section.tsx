import { useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { DevelopmentSection } from "@/features/development/components/development-section";
import { BudgetSwipe } from "./budget-swipe";
import { BudgetTabs, type BudgetTabKey } from "./budget-tabs";
import { PayCheckLoader } from "./pay-check-loader";

/**
 * Une page du budget : l'en-tête de Financier, puis les onglets du budget. Le
 * contenu se glisse vers l'onglet suivant ou celui d'avant.
 */
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
      <BudgetSwipe current={current}>{children}</BudgetSwipe>
      {/* « As-tu reçu ta paie? » : s'ouvre seule le jour de la paie */}
      <Suspense fallback={null}>
        <PayCheckLoader />
      </Suspense>
    </DevelopmentSection>
  );
}
