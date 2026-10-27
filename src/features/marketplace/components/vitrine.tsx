import {
  Activity,
  Apple,
  BadgeCheck,
  BookOpen,
  Brain,
  Dumbbell,
  Handshake,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { pillarIcons, type Pillar } from "@/config/pillars";
import { KIND_PILLAR } from "@/features/development/questionnaires";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listPlans } from "@/server/development/service";
import { listCatalog, type ListingSummary } from "@/server/marketplace/service";
import {
  VITRINE_CATEGORIES,
  VITRINE_COLLECTION_SIZE,
  VITRINE_PLAN_COLLECTIONS,
  type ListingCategory,
  type ListingKind,
} from "../rules";
import { FavoriteButton } from "./favorite-button";
import { ListingPrice } from "./listing-price";

// Vitrine de la Marketplace (design « Vitrine ») : catégories en icônes, puis
// des collections en grandes cartes. Aucune mise en avant payée.

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: Sparkles,
  services: Handshake,
  gear: ShoppingBag,
  fitness_coach: Activity,
  nutritionist: Apple,
  financial_advisor: Wallet,
  psychologist: Brain,
  clothing: Shirt,
  equipment: Dumbbell,
  books: BookOpen,
};

const baseOf = (kind: ListingKind) =>
  kind === "service" ? "/marketplace" : "/marketplace/gear";

/**
 * Rangée d'icônes : catégories de l'onglet, et l'autre onglet au bout.
 * `onGear` : page Gear (bientôt), affichée avec la rangée des services.
 */
export function CategoryRow({
  kind,
  current,
  onGear = false,
}: {
  kind: ListingKind;
  current: ListingCategory | undefined;
  onGear?: boolean;
}) {
  const t = useTranslations("Marketplace.vitrine.categories");
  const base = baseOf(kind);
  const items = [
    ...(kind === "gear"
      ? [{ key: "services", href: "/marketplace", active: false }]
      : []),
    { key: "all", href: base, active: current === undefined && !onGear },
    ...VITRINE_CATEGORIES[kind].map((category) => ({
      key: category,
      href: `${base}?category=${category}`,
      active: current === category,
    })),
    ...(kind === "service"
      ? [{ key: "gear", href: "/marketplace/gear", active: onGear }]
      : []),
  ];

  return (
    <nav
      aria-label={t("label")}
      className="-mx-4 flex [scrollbar-width:none] gap-6 overflow-x-auto border-b border-white/8 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const Icon = CATEGORY_ICONS[item.key] ?? Sparkles;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1.5 rounded-sm pt-1 pb-2.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              item.active
                ? "text-foreground shadow-[inset_0_-2px_0_var(--primary)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-6" />
            {t(item.key as "all")}
          </Link>
        );
      })}
    </nav>
  );
}

/** Grande carte d'une annonce : photo (ou motif et pilier), titre, prix. */
function VitrineCard({ listing }: { listing: ListingSummary }) {
  const t = useTranslations("Marketplace");
  const Icon = pillarIcons[listing.pillar];
  const seller = listing.seller.displayName ?? listing.seller.username ?? "";

  return (
    <div className="relative flex w-64 shrink-0 snap-start flex-col gap-2.5">
      <Link
        href={`/marketplace/${listing.id}`}
        className="group flex flex-col gap-2.5 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="relative block aspect-[5/4] overflow-hidden rounded-2xl bg-white/5">
          {listing.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photo.url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.04)_0_12px,transparent_12px_24px)] text-silver"
            >
              <Icon className="size-10" />
              <span className="text-xs font-medium text-muted-foreground">
                {t(`categories.${listing.category as ListingCategory}`)}
              </span>
            </span>
          )}
          <span className="absolute top-3 left-3 flex h-7 items-center gap-1.5 rounded-full bg-white/95 px-2.5 text-xs font-bold text-primary-foreground">
            <BadgeCheck aria-hidden="true" className="size-3.5" />
            {t("vitrine.approved")}
          </span>
        </span>
        <span className="flex flex-col gap-0.5 px-0.5">
          <span className="line-clamp-2 font-semibold text-pretty break-words">
            {listing.title}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {seller
              ? `${seller} · ${t(`categories.${listing.category as ListingCategory}`)}`
              : t(`categories.${listing.category as ListingCategory}`)}
          </span>
          <ListingPrice
            minCents={listing.priceMinCents}
            maxCents={listing.priceMaxCents}
            unit={listing.priceUnit}
            className="text-sm"
          />
        </span>
      </Link>
      <FavoriteButton
        listingId={listing.id}
        title={listing.title}
        initial={listing.favorite}
        overlay
        className="absolute top-1.5 right-1.5"
      />
    </div>
  );
}

/** Une collection : titre, « Tout voir », cartes qui défilent de côté. */
function VitrineRow({
  id,
  title,
  seeAll,
  items,
}: {
  id: string;
  title: string;
  seeAll: string;
  items: ListingSummary[];
}) {
  const t = useTranslations("Marketplace.vitrine");
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-heading text-lg font-bold">
          {title}
        </h2>
        <Link
          href={seeAll}
          className="shrink-0 rounded-sm text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("seeAll")}
        </Link>
      </div>
      {/* scroll-px : l'aimantation garde la marge de la page sur téléphone */}
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((listing) => (
          <li key={listing.id}>
            <VitrineCard listing={listing} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Collections de l'onglet : « Pour ton plan » (piliers de tes plans de Mon
 * développement, sinon tes piliers prioritaires), puis les nouveautés. Null
 * quand le catalogue est vide.
 */
export async function VitrineCollections({
  kind,
  viewerId,
  focusPillars,
}: {
  kind: ListingKind;
  viewerId: string;
  focusPillars: Pillar[];
}) {
  const [plans, t, tPillars] = await Promise.all([
    listPlans(viewerId),
    getTranslations("Marketplace.vitrine"),
    getTranslations("Pillars"),
  ]);
  const fromPlans = [
    ...new Set(
      [...plans]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((plan) => KIND_PILLAR[plan.kind]),
    ),
  ];
  const pillars = (fromPlans.length > 0 ? fromPlans : focusPillars).slice(
    0,
    VITRINE_PLAN_COLLECTIONS,
  );
  const [latest, ...byPillar] = await Promise.all([
    listCatalog(viewerId, kind, {}),
    ...pillars.map((pillar) => listCatalog(viewerId, kind, { pillar })),
  ]);
  if (!latest || latest.items.length === 0) return null;
  const base = baseOf(kind);

  return (
    <div className="flex flex-col gap-8">
      {pillars.map((pillar, index) => {
        const items = byPillar[index]?.items ?? [];
        return items.length > 0 ? (
          <VitrineRow
            key={pillar}
            id={`vitrine-${kind}-${pillar}`}
            title={t(fromPlans.length > 0 ? "forPlan" : "forPillar", {
              pillar: tPillars(`${pillar}.name`),
            })}
            seeAll={`${base}?pillar=${pillar}`}
            items={items.slice(0, VITRINE_COLLECTION_SIZE)}
          />
        ) : null;
      })}
      <VitrineRow
        id={`vitrine-${kind}-latest`}
        title={t("latest")}
        seeAll={`${base}?view=list`}
        items={latest.items.slice(0, VITRINE_COLLECTION_SIZE)}
      />
    </div>
  );
}
