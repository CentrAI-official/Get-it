import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type ListingPriceProps = {
  minCents: number;
  maxCents: number | null;
  unit: string;
  className?: string;
};

/** « 80 $ – 120 $ / séance », « 45 $ » : sans décimales quand le montant est rond. */
export function ListingPrice({
  minCents,
  maxCents,
  unit,
  className,
}: ListingPriceProps) {
  const t = useTranslations("Marketplace.price");
  const format = useFormatter();
  const money = (cents: number) =>
    format.number(cents / 100, {
      style: "currency",
      currency: "CAD",
      // « 80 $ » plutôt que « 80 $CA » (la langue est « fr », pas « fr-CA »)
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
  const amount =
    maxCents !== null && maxCents !== minCents
      ? t("range", { min: money(minCents), max: money(maxCents) })
      : money(minCents);

  return (
    <p className={cn("font-heading font-bold", className)}>
      {amount}
      {unit === "item" ? null : (
        <span className="text-sm font-normal text-muted-foreground">
          {" "}
          {t(`units.${unit as "session" | "hour" | "month" | "package"}`)}
        </span>
      )}
    </p>
  );
}
