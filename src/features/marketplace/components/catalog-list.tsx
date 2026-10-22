"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ListingSummary } from "@/server/marketplace/service";
import { loadMoreListingsAction } from "../actions";
import type { CatalogFilters, ListingKind } from "../rules";
import { ListingCard } from "./listing-card";

type CatalogListProps = {
  kind: ListingKind;
  filters: CatalogFilters;
  initial: ListingSummary[];
  nextCursor: string | null;
};

/** Annonces du catalogue, 20 à la fois (« Voir plus », pas de défilement infini). */
export function CatalogList({
  kind,
  filters,
  initial,
  nextCursor,
}: CatalogListProps) {
  const t = useTranslations("Marketplace.catalog");
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    const page = await loadMoreListingsAction(kind, filters, cursor);
    setLoading(false);
    if (!page) return;
    setItems((current) => [...current, ...page.items]);
    setCursor(page.nextCursor);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {items.map((listing) => (
          <li key={listing.id} className="border-b border-white/8">
            <ListingCard listing={listing} />
          </li>
        ))}
      </ul>
      {cursor ? (
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={loading}
          className="w-fit self-center"
        >
          {loading ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {t("more")}
        </Button>
      ) : null}
    </div>
  );
}
