"use client";

import { LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { PILLARS } from "@/config/pillars";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  PRICE_RANGE_KEYS,
  REGIONS,
  type CatalogFilters,
  type ListingKind,
} from "../rules";

const chip =
  "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const select =
  "h-10 w-full min-w-0 rounded-full border border-white/12 bg-white/[0.03] px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover";

/**
 * Filtres du catalogue : pilier pour tous, région et tranche de prix pour les
 * services. Ils vivent dans l'adresse (lien partageable).
 */
export function CatalogFilterBar({
  kind,
  filters,
}: {
  kind: ListingKind;
  filters: CatalogFilters;
}) {
  const t = useTranslations("Marketplace.filters");
  const tPillars = useTranslations("Pillars");
  const tRegions = useTranslations("Marketplace.regions");
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const base = kind === "service" ? "/marketplace" : "/marketplace/gear";
  const active = Boolean(filters.pillar || filters.region || filters.price);

  function apply(next: CatalogFilters) {
    const params = new URLSearchParams();
    if (next.pillar) params.set("pillar", next.pillar);
    if (kind === "service" && next.region) params.set("region", next.region);
    if (kind === "service" && next.price) params.set("price", next.price);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${base}?${query}` : base, { scroll: false });
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <div
        role="radiogroup"
        aria-label={t("pillar")}
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
      >
        {[undefined, ...PILLARS].map((pillar) => {
          const checked = filters.pillar === pillar;
          return (
            <button
              key={pillar ?? "all"}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => apply({ ...filters, pillar })}
              className={cn(
                chip,
                checked
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {pillar ? tPillars(`${pillar}.name`) : t("all")}
            </button>
          );
        })}
      </div>

      {kind === "service" ? (
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor={`${id}-region`} className="sr-only">
            {t("region")}
          </label>
          <select
            id={`${id}-region`}
            value={filters.region ?? ""}
            onChange={(event) =>
              apply({
                ...filters,
                region: REGIONS.find((item) => item === event.target.value),
              })
            }
            className={select}
          >
            <option value="">{t("anyRegion")}</option>
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {tRegions(region)}
              </option>
            ))}
          </select>
          <label htmlFor={`${id}-price`} className="sr-only">
            {t("price")}
          </label>
          <select
            id={`${id}-price`}
            value={filters.price ?? ""}
            onChange={(event) =>
              apply({
                ...filters,
                price: PRICE_RANGE_KEYS.find(
                  (item) => item === event.target.value,
                ),
              })
            }
            className={select}
          >
            <option value="">{t("anyPrice")}</option>
            {PRICE_RANGE_KEYS.map((range) => (
              <option key={range} value={range}>
                {t(`prices.${range}`)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {active || pending ? (
        <div className="flex items-center gap-3 text-sm">
          {active ? (
            <button
              type="button"
              onClick={() => apply({})}
              className="flex items-center gap-1 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-4" />
              {t("clear")}
            </button>
          ) : null}
          {pending ? (
            <LoaderCircle
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
