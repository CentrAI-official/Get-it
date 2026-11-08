import {
  ArrowLeftRight,
  Check,
  ChevronRight,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Store,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityFeed } from "@/features/community/components/community-feed";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { PostComposer } from "@/features/community/components/post-composer";
import { IdentitySwitch } from "@/features/identity/components/identity-switch";
import { ListingCard } from "@/features/marketplace/components/listing-card";
import { Link, redirect } from "@/i18n/navigation";
import { listFeed } from "@/server/community/feed";
import { getCommunityMember } from "@/server/community/members";
import { listMyListings } from "@/server/marketplace/service";
import { countUnread } from "@/server/messages/service";
import { countUnreadNotifications } from "@/server/notifications/service";
import { pageFollowState } from "@/server/pages/follows";
import { getMyPage } from "@/server/pages/service";
import { avatarUrl } from "@/server/profile/avatar";
import { getCurrentProfile } from "@/server/profile/service";
import { storageEnabled } from "@/server/storage/service";
import { pageCompletion } from "../rules";
import { DeletePage } from "./delete-page";
import { PageForm } from "./page-form";
import { PageImages } from "./page-images";
import { PageLogo } from "./page-logo";

// La page vue de l'intérieur, en mode page (son « Profil ») : l'en-tête, ce
// qu'il lui manque, ses services et ses publications. Chaque vue lit la
// session : à placer dans un <Suspense>.

/** L'en-tête d'une page : couverture, logo, nom, domaine et régions. */
export async function PageHero({
  page,
  children,
}: {
  page: {
    name: string;
    category: string;
    regions: string[];
    logoUrl: string | null;
    coverUrl: string | null;
  };
  children?: React.ReactNode;
}) {
  const [tCategories, tRegions, t] = await Promise.all([
    getTranslations("Marketplace.categories"),
    getTranslations("Marketplace.regions"),
    getTranslations("Pages"),
  ]);
  const regions = page.regions
    .slice(0, 3)
    .map((region) => tRegions(region as "online"));
  return (
    <header className="flex flex-col">
      {page.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.coverUrl}
          alt=""
          className="aspect-[3/1] w-full rounded-2xl object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="aspect-[3/1] w-full rounded-2xl bg-foreground/[0.06]"
        />
      )}
      <div className="-mt-10 flex flex-col gap-3 px-1">
        <PageLogo
          name={page.name}
          url={page.logoUrl}
          className="size-20 text-4xl ring-4 ring-background"
        />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight break-words">
            {page.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {tCategories(page.category as "other")}
            </span>
            {regions.length > 0 ? (
              <span className="flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5" />
                {regions.join(", ")}
                {page.regions.length > 3
                  ? ` ${t("moreRegions", { count: page.regions.length - 3 })}`
                  : null}
              </span>
            ) : null}
          </p>
        </div>
        {children}
      </div>
    </header>
  );
}

/**
 * Revenir à son compte personnel (la bascule, comme sur Facebook), avec ce qui
 * l'attend : messages et notifications non lus.
 */
export async function BackToAccount() {
  const profile = await getCurrentProfile();
  const [photo, messages, notifications, t] = await Promise.all([
    avatarUrl(profile.avatarPath),
    countUnread(profile.id).catch(() => 0),
    countUnreadNotifications(profile.id, null).catch(() => 0),
    getTranslations("Pages.switch"),
  ]);
  const name = profile.displayName ?? profile.email ?? "";
  const news = messages + notifications;
  return (
    <IdentitySwitch
      to="personal"
      className="flex min-h-11 w-fit items-center gap-2.5 rounded-full bg-foreground/[0.05] py-1 pr-4 pl-1 text-sm font-medium outline-none hover:bg-foreground/[0.08] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <Avatar name={name} url={photo} className="size-9 text-sm" />
      <ArrowLeftRight
        aria-hidden="true"
        className="size-4 text-muted-foreground"
      />
      {t("toAccount")}
      {news > 0 ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          {t("unread", { count: news })}
        </span>
      ) : null}
    </IdentitySwitch>
  );
}

/** Le cookie demande une page qui n'existe plus : on propose de revenir à son compte. */
async function NoPage() {
  const t = await getTranslations("Pages.switch");
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">{t("gone")}</p>
      <IdentitySwitch
        to="personal"
        className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        {t("toAccount")}
      </IdentitySwitch>
    </div>
  );
}

/**
 * Le profil de la page (mode page) : l'en-tête, ce qu'il lui manque, ses
 * services, puis ses publications, où l'on publie en son nom.
 */
export async function ProHome() {
  const profile = await getCurrentProfile();
  const page = await getMyPage(profile.id);
  if (!page) return <NoPage />;
  const [listings, follow, member, feed, t] = await Promise.all([
    listMyListings(profile.id),
    pageFollowState(profile.id, page.id),
    getCommunityMember(profile.id),
    listFeed(profile.id, { pageId: page.id, asPageId: page.id }),
    getTranslations("Pages"),
  ]);
  const canWrite = Boolean(member?.joined && !member.suspendedUntil);
  const tFollows = await getTranslations("Follows");
  const completion = pageCompletion({ ...page, services: listings.length });
  const links = {
    logo: "/pro/edit",
    cover: "/pro/edit",
    about: "/pro/edit",
    service: "/marketplace/sell",
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <BackToAccount />
      <PageHero page={page}>
        <p className="text-sm text-muted-foreground tabular-nums">
          {tFollows("followers", { count: follow.followers })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11">
            <Link href={`/pages/${page.handle}`}>
              <ExternalLink aria-hidden="true" />
              {t("home.viewPublic")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/pro/edit">
              <Pencil aria-hidden="true" />
              {t("home.edit")}
            </Link>
          </Button>
        </div>
      </PageHero>

      {completion.done < completion.steps.length ? (
        <section
          aria-labelledby="pro-completion"
          className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="pro-completion"
              className="caps-label text-muted-foreground"
            >
              {t("home.completeTitle")}
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("home.completeCount", {
                done: completion.done,
                total: completion.steps.length,
              })}
            </span>
          </div>
          <ul className="flex flex-col">
            {completion.steps.map((step) => (
              <li
                key={step.key}
                className="border-b border-foreground/8 last:border-b-0"
              >
                {step.done ? (
                  <span className="flex min-h-12 items-center gap-3 text-sm text-muted-foreground line-through">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check
                        aria-hidden="true"
                        className="size-3.5"
                        strokeWidth={3}
                      />
                    </span>
                    {t(`home.steps.${step.key}`)}
                  </span>
                ) : (
                  <Link
                    href={links[step.key]}
                    className="flex min-h-12 items-center gap-3 text-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      aria-hidden="true"
                      className="size-6 rounded-full border-2 border-foreground/20"
                    />
                    <span className="flex-1">
                      {t(`home.steps.${step.key}`)}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PageServices listings={listings} />

      <section
        aria-labelledby="pro-posts"
        className="flex flex-col gap-4 border-t border-foreground/8 pt-6"
      >
        <h2 id="pro-posts" className="caps-label text-muted-foreground">
          {t("home.posts")}
        </h2>
        {canWrite ? (
          <PostComposer
            shareable={[]}
            preselected={null}
            name={page.name}
            avatarUrl={page.logoUrl}
            mediaEnabled={storageEnabled()}
            asPage={{ name: page.name, logoUrl: page.logoUrl }}
          />
        ) : null}
        <CommunityFeed
          // Une nouvelle publication ou une suppression recharge la liste
          key={feed.posts[0]?.id ?? "empty"}
          initialPosts={feed.posts}
          initialCursor={feed.nextCursor}
          now={feed.loadedAt}
          canWrite={canWrite}
          pageId={page.id}
          asPage
          empty={{
            title: t("home.noPostsTitle"),
            description: t("home.noPosts"),
          }}
        />
      </section>
    </div>
  );
}

/** Les services de la page et leur statut (profil de la page, Marketplace en mode page). */
export async function PageServices({
  listings,
}: {
  listings: Awaited<ReturnType<typeof listMyListings>>;
}) {
  const t = await getTranslations("Pages");
  return (
    <section
      aria-labelledby="pro-services"
      className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="pro-services" className="caps-label text-muted-foreground">
          {t("home.services")}
        </h2>
        <Button asChild variant="outline" size="sm" className="h-10">
          <Link href="/marketplace/sell">
            <Plus aria-hidden="true" />
            {t("home.addService")}
          </Link>
        </Button>
      </div>
      {listings.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
          <Store aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("home.noService")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {listings.map((listing) => (
            <li key={listing.id} className="border-b border-foreground/8 pb-3">
              <ListingCard listing={listing} showFavorite={false} />
              <span
                className={
                  listing.status === "approved"
                    ? "rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
                    : "rounded-full bg-foreground/8 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                {t(`home.status.${listing.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Créer sa page : membre du Centre d'abord, une seule page par personne. */
export async function ProNew() {
  const profile = await getCurrentProfile();
  const [page, member, t] = await Promise.all([
    getMyPage(profile.id),
    getCommunityMember(profile.id),
    getTranslations("Pages.new"),
  ]);
  if (page) redirect({ href: "/pro", locale: await getLocale() });
  if (!member?.joined) return <JoinCommunityCard />;
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-2 text-sm">
        {(["sell", "clients", "feed"] as const).map((key) => (
          <li key={key} className="flex items-start gap-2">
            <Check
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            {t(`points.${key}`)}
          </li>
        ))}
      </ul>
      <PageForm
        mode="create"
        initial={{
          name: profile.displayName ?? "",
          handle: "",
          category: "",
          about: "",
          regions: [],
          website: "",
        }}
      />
    </div>
  );
}

/** Modifier sa page : images, informations, et la supprimer. */
export async function ProEdit() {
  const profile = await getCurrentProfile();
  const page = await getMyPage(profile.id);
  if (!page) return <NoPage />;
  const t = await getTranslations("Pages.edit");
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="pro-images" className="flex flex-col gap-3">
        <h2 id="pro-images" className="caps-label text-muted-foreground">
          {t("images")}
        </h2>
        <PageImages
          name={page.name}
          logoUrl={page.logoUrl}
          coverUrl={page.coverUrl}
          enabled={storageEnabled()}
        />
      </section>
      <section
        aria-labelledby="pro-info"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <h2 id="pro-info" className="caps-label text-muted-foreground">
          {t("info")}
        </h2>
        <PageForm
          mode="update"
          initial={{
            name: page.name,
            handle: page.handle,
            category: page.category,
            about: page.about,
            regions: page.regions,
            website: page.website ?? "",
          }}
        />
      </section>
      <section className="flex flex-col gap-2 border-t border-foreground/8 pt-6">
        <p className="text-xs text-pretty text-muted-foreground">
          {t("deleteHint")}
        </p>
        <DeletePage name={page.name} />
      </section>
    </div>
  );
}

export function ProSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-11 w-48 rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Skeleton className="aspect-[3/1] w-full rounded-2xl" />
      <Skeleton className="-mt-10 ml-1 size-20 rounded-2xl" />
      <Skeleton className="h-7 w-56" />
    </div>
  );
}
