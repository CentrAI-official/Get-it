import { useLocale } from "next-intl";

/**
 * Pourcentage d'affichage : le nombre en grand, le signe en petit et sans espace
 * (les libellés accessibles gardent le format complet de la langue).
 */
export function PercentValue({ part }: { part: number }) {
  const locale = useLocale();
  const parts = new Intl.NumberFormat(locale, {
    style: "percent",
  }).formatToParts(part);

  return parts.map((item, index) =>
    item.type === "percentSign" ? (
      <span key={index} className="ml-[0.06em] text-[0.62em]">
        {item.value}
      </span>
    ) : item.type === "literal" && !item.value.trim() ? null : (
      item.value
    ),
  );
}
