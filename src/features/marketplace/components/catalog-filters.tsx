"use client";

import { LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  PRICE_RANGE_KEYS,
  REGIONS,
  SERVICE_MODES,
  type CatalogFilters,
  type ListingKind,
} from "../rules";

const chip =
  "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const select =
  "h-10 w-full min-w-0 rounded-full border border-white/12 bg-white/[0.03] px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover";

/**
 * Filtres du catalogue : « Où », région et tranche de prix pour les services
 * (les catégories de la Vitrine remplacent le filtre par pilier). Le pilier
 * n'arrive que par « Voir tout » d'une collection « Pour ton plan » : il
 * s'affiche alors en une pastille qui se retire. Les filtres vivent dans
 * l'adresse (lien partageable).
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
  const active = Boolean(
    filters.pillar || filters.mode || filters.region || filters.price,
  );

  function apply(next: CatalogFilters) {
    const params = new URLSearchParams();
    if (next.pillar) params.set("pillar", next.pillar);
    if (kind === "service" && next.mode) params.set("mode", next.mode);
    if (kind === "service" && next.region) params.set("region", next.region);
    if (kind === "service" && next.price) params.set("price", next.price);
    // La recherche, la catégorie et « Tout voir » restent quand un filtre change
    if (next.category) params.set("category", next.category);
    if (next.q) params.set("q", next.q);
    if (next.view) params.set("view", next.view);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${base}?${query}` : base, { scroll: false });
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      {filters.pillar ? (
        <button
          type="button"
          aria-label={t("removePillar", {
            pillar: tPillars(`${filters.pillar}.name`),
          })}
          onClick={() => apply({ ...filters, pillar: undefined })}
          className={cn(
            chip,
            "flex w-fit items-center gap-1.5 border-primary bg-primary/15 text-foreground",
          )}
        >
          {tPillars(`${filters.pillar}.name`)}
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}

      {kind === "service" ? (
        <div
          role="radiogroup"
          aria-label={t("mode")}
          className="flex flex-wrap gap-2"
        >
          {[undefined, ...SERVICE_MODES].map((mode) => {
            const checked = filters.mode === mode;
            return (
              <button
                key={mode ?? "both"}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => apply({ ...filters, mode })}
                className={cn(
                  chip,
                  checked
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`modes.${mode ?? "both"}`)}
              </button>
            );
          })}
        </div>
      ) : null}

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
              onClick={() =>
                apply({
                  category: filters.category,
                  q: filters.q,
                  view: filters.view,
                })
              }
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
