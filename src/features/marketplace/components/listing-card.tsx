import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import type { ListingSummary } from "@/server/marketplace/service";
import type { ListingCategory, Region } from "../rules";
import { FavoriteButton } from "./favorite-button";
import { ListingPrice } from "./listing-price";

/**
 * Annonce du catalogue, façon Amazon : photo, titre, courte description, prix
 * et, pour un service, la région.
 */
export function ListingCard({
  listing,
  showFavorite = true,
}: {
  listing: ListingSummary;
  /** Faux pour ses propres annonces (« Mes annonces »). */
  showFavorite?: boolean;
}) {
  const t = useTranslations("Marketplace");
  const tPillars = useTranslations("Pillars");
  const Icon = pillarIcons[listing.pillar];
  const [firstRegion, ...otherRegions] = listing.regions as Region[];

  return (
    <div className="flex items-start gap-1">
      <Link
        href={`/marketplace/${listing.id}`}
        className="-mx-3 flex min-w-0 flex-1 gap-3.5 rounded-2xl px-3 py-4 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-foreground/5">
          {listing.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photo.url}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <Icon aria-hidden="true" className="size-7 text-silver" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t(`categories.${listing.category as ListingCategory}`)} ·{" "}
            {tPillars(`${listing.pillar}.name`)}
          </span>
          <span className="line-clamp-2 font-semibold text-pretty break-words">
            {listing.title}
          </span>
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {listing.summary}
          </span>
          <ListingPrice
            minCents={listing.priceMinCents}
            maxCents={listing.priceMaxCents}
            unit={listing.priceUnit}
          />
          {firstRegion ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">
                {t(`regions.${firstRegion}`)}
                {otherRegions.length > 0
                  ? ` ${t("moreRegions", { count: otherRegions.length })}`
                  : null}
              </span>
            </span>
          ) : null}
        </span>
      </Link>
      {showFavorite ? (
        <FavoriteButton
          listingId={listing.id}
          title={listing.title}
          initial={listing.favorite}
          className="mt-3 -mr-2"
        />
      ) : null}
    </div>
  );
}
