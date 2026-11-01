import { useTranslations } from "next-intl";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
} from "@/features/analytics/rules";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Choix de la période (7, 30 ou 90 jours), gardé dans l'adresse (?p=). */
export function PeriodTabs({
  href,
  period,
}: {
  href: `/${string}`;
  period: DashboardPeriod;
}) {
  const t = useTranslations("Admin.period");
  return (
    <nav aria-label={t("label")} className="flex">
      <ul className="inline-flex rounded-full border border-foreground/6 bg-raised p-1">
        {DASHBOARD_PERIODS.map((days) => (
          <li key={days}>
            <Link
              href={`${href}?p=${days}`}
              scroll={false}
              aria-current={days === period ? "page" : undefined}
              className={cn(
                "flex rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                days === period
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("option", { days })}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
