import {
  ClipboardCheck,
  ExternalLink,
  ListChecks,
  MapPin,
  Store,
  UsersRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostMedia } from "@/features/community/components/post-media";
import { recordIdSchema } from "@/features/goals/schemas";
import { Link } from "@/i18n/navigation";
import { getCommunityMember } from "@/server/community/members";
import {
  countPendingListings,
  getListing,
  listCatalog,
  listMyListings,
  listPendingListings,
  type ListingDetail,
  type ListingPhoto,
} from "@/server/marketplace/service";
import { getCurrentProfile } from "@/server/profile/service";
import { storageEnabled } from "@/server/storage/service";
import {
  catalogFiltersSchema,
  type ListingCategory,
  type ListingKind,
  type Region,
} from "../rules";
import { BecomeAffiliate } from "./become-affiliate";
import { CatalogFilterBar } from "./catalog-filters";
import { CatalogList } from "./catalog-list";
import { ContactSeller, DeleteListing } from "./listing-actions";
import { ListingCard } from "./listing-card";
import { ListingForm } from "./listing-form";
import { ListingPrice } from "./listing-price";
import { ReviewControls } from "./review-controls";

// Pages du Marketplace. Chacune lit la session : à placer dans un <Suspense>.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const asMedia = (photos: ListingPhoto[]) =>
  photos.map((photo) => ({
    kind: "image" as const,
    url: photo.url,
    posterUrl: null,
    width: photo.width,
    height: photo.height,
    durationMs: null,
  }));

const link =
  "flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/** Catalogue d'un onglet : liens du vendeur et de l'équipe, filtres, annonces. */
export async function CatalogPanel({
  kind,
  searchParams,
}: {
  kind: ListingKind;
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;
  const filters = catalogFiltersSchema.parse({
    pillar: one(params.pillar),
    region: kind === "service" ? one(params.region) : undefined,
    price: kind === "service" ? one(params.price) : undefined,
  });
  const [page, pending, t] = await Promise.all([
    listCatalog(profile.id, kind, filters),
    countPendingListings(profile.id),
    getTranslations("Marketplace"),
  ]);
  const filtered = Boolean(filters.pillar || filters.region || filters.price);

  return (
    <div className="flex flex-col gap-5">
      {profile.accountType === "affiliate" || pending !== null ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {profile.accountType === "affiliate" ? (
            <Link href="/marketplace/mine" className={link}>
              <ListChecks aria-hidden="true" className="size-4" />
              {t("mine.link")}
            </Link>
          ) : null}
          {pending !== null ? (
            <Link href="/marketplace/approvals" className={link}>
              <ClipboardCheck aria-hidden="true" className="size-4" />
              {t("approvals.link", { count: pending })}
            </Link>
          ) : null}
        </div>
      ) : null}

      <CatalogFilterBar kind={kind} filters={filters} />

      {page.items.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t(
            filtered ? "catalog.noMatchTitle" : `catalog.emptyTitle.${kind}`,
          )}
          description={t(
            filtered
              ? "catalog.noMatchDescription"
              : "catalog.emptyDescription",
          )}
          action={
            filtered ? null : (
              <Button asChild>
                <Link href="/marketplace/sell">{t("catalog.sell")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <CatalogList
          key={JSON.stringify(filters)}
          kind={kind}
          filters={filters}
          initial={page.items}
          nextCursor={page.nextCursor}
        />
      )}
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-3.5 py-4">
          <Skeleton className="size-24 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Corps d'une annonce, partagé par sa page et la file d'approbation. Le bouton
 * d'action (`actions`) suit le prix, comme sur Amazon.
 */
async function ListingBody({
  listing,
  actions,
}: {
  listing: ListingDetail;
  actions?: ReactNode;
}) {
  const [t, tPillars] = await Promise.all([
    getTranslations("Marketplace"),
    getTranslations("Pillars"),
  ]);
  const seller = listing.seller.displayName ?? listing.seller.username ?? "";

  return (
    <>
      {listing.photos.length > 0 ? (
        <PostMedia media={asMedia(listing.photos)} />
      ) : null}
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t(`categories.${listing.category as ListingCategory}`)} ·{" "}
          {tPillars(`${listing.pillar}.name`)}
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-pretty break-words">
          {listing.title}
        </h1>
        <ListingPrice
          minCents={listing.priceMinCents}
          maxCents={listing.priceMaxCents}
          unit={listing.priceUnit}
          className="text-xl"
        />
        <p className="text-muted-foreground">{listing.summary}</p>
      </header>
      {actions}

      {listing.regions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin aria-hidden="true" className="size-4 text-silver" />
            {t("detail.regions")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {(listing.regions as Region[]).map((region) => (
              <li
                key={region}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm"
              >
                {t(`regions.${region}`)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 border-t border-white/8 pt-6">
        <h2 className="font-heading text-lg font-bold">
          {t("detail.description")}
        </h2>
        <p className="break-words whitespace-pre-wrap">{listing.description}</p>
      </section>

      <section className="flex flex-col gap-3 border-t border-white/8 pt-6">
        <h2 className="font-heading text-lg font-bold">{t("detail.seller")}</h2>
        <p className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full orb font-heading font-bold uppercase"
          >
            {seller.charAt(0)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{seller}</span>
            <span className="truncate text-sm text-muted-foreground">
              @{listing.seller.username}
            </span>
          </span>
        </p>
        {listing.website || listing.socialUrl ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              ["website", listing.website],
              ["social", listing.socialUrl],
            ].map(([key, url]) =>
              url ? (
                <li key={key}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className={link}
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    {t(`detail.${key as "website" | "social"}`)}
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
      </section>
    </>
  );
}

/** Page d'une annonce. */
export async function ListingLoader({ id }: { id: string }) {
  const profile = await getCurrentProfile();
  const listingId = recordIdSchema.safeParse(id);
  if (!listingId.success) notFound();
  const listing = await getListing(profile.id, listingId.data);
  if (!listing) notFound();
  const t = await getTranslations("Marketplace");

  return (
    <article className="flex flex-col gap-6">
      {listing.mine && listing.status !== "approved" ? (
        <p
          role="status"
          className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
        >
          {t(`status.${listing.status}Notice`)}
          {listing.reviewNote ? ` ${listing.reviewNote}` : null}
        </p>
      ) : null}
      <ListingBody
        listing={listing}
        actions={
          <div className="flex gap-2">
            {listing.mine ? (
              <DeleteListing listingId={listing.id} />
            ) : (
              <ContactSeller sellerId={listing.sellerId} />
            )}
          </div>
        }
      />
    </article>
  );
}

export function ListingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

/** « Vendre » : affilié et membre du Centre, sinon ce qu'il reste à faire. */
export async function SellGate() {
  const profile = await getCurrentProfile();
  if (profile.accountType !== "affiliate") return <BecomeAffiliate />;
  const [member, t] = await Promise.all([
    getCommunityMember(profile.id),
    getTranslations("Marketplace.sell"),
  ]);
  if (!member?.joined) {
    return (
      <EmptyState
        icon={UsersRound}
        title={t("joinTitle")}
        description={t("joinDescription")}
        action={
          <Button asChild>
            <Link href="/community">{t("joinAction")}</Link>
          </Button>
        }
      />
    );
  }
  if (member.suspendedUntil) {
    return <p className="text-sm text-muted-foreground">{t("suspended")}</p>;
  }
  return (
    <ListingForm
      defaultEmail={profile.email ?? ""}
      defaultName={profile.displayName ?? ""}
      photosEnabled={storageEnabled()}
    />
  );
}

/** Annonces du vendeur et leur statut (en attente, en ligne, refusée). */
export async function MyListingsPanel() {
  const profile = await getCurrentProfile();
  const [listings, t] = await Promise.all([
    listMyListings(profile.id),
    getTranslations("Marketplace"),
  ]);
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title={t("mine.emptyTitle")}
        description={t("mine.emptyDescription")}
        action={
          <Button asChild>
            <Link href="/marketplace/sell">{t("catalog.sell")}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="flex flex-col">
      {listings.map((listing) => (
        <li key={listing.id} className="border-b border-white/8 pb-3">
          <ListingCard listing={listing} />
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={
                listing.status === "approved"
                  ? "rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
                  : "rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {t(`status.${listing.status}`)}
            </span>
            {listing.status === "rejected" && listing.reviewNote ? (
              <span className="text-muted-foreground">
                {listing.reviewNote}
              </span>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** File d'approbation : réservée à l'équipe Get iT (rôle admin). */
export async function ApprovalsPanel() {
  const profile = await getCurrentProfile();
  const [listings, t] = await Promise.all([
    listPendingListings(profile.id),
    getTranslations("Marketplace.approvals"),
  ]);
  if (listings === null) notFound();
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }
  return (
    <ol className="flex flex-col">
      {listings.map((listing) => (
        <li
          key={listing.id}
          className="flex flex-col gap-6 border-b border-white/8 py-8 first:pt-0"
        >
          <ListingBody listing={listing} />
          <section className="flex flex-col gap-2 border-t border-white/8 pt-6">
            <h2 className="font-heading text-lg font-bold">{t("private")}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t("name")}</dt>
              <dd className="break-words">{listing.contactName}</dd>
              <dt className="text-muted-foreground">{t("email")}</dt>
              <dd className="break-all">{listing.contactEmail}</dd>
              {listing.licenseNumber ? (
                <>
                  <dt className="text-muted-foreground">{t("license")}</dt>
                  <dd className="font-mono break-all">
                    {listing.licenseNumber}
                  </dd>
                </>
              ) : null}
            </dl>
            {listing.licenseNumber ? (
              <p className="text-xs text-muted-foreground">
                {t("licenseHint")}
              </p>
            ) : null}
          </section>
          <ReviewControls listingId={listing.id} />
        </li>
      ))}
    </ol>
  );
}
