import { Globe, Pencil, Store } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityFeed } from "@/features/community/components/community-feed";
import { ContactSeller } from "@/features/marketplace/components/listing-actions";
import { ListingCard } from "@/features/marketplace/components/listing-card";
import { Link } from "@/i18n/navigation";
import { listFeed } from "@/server/community/feed";
import { getCommunityMember } from "@/server/community/members";
import { pageFollowState } from "@/server/pages/follows";
import { getActingPage } from "@/server/pages/identity";
import { getPublicPage } from "@/server/pages/service";
import { getCurrentProfile } from "@/server/profile/service";
import { HANDLE_PATTERN } from "../rules";
import { ClientRequestArea } from "@/features/clients/components/clients-views";
import { FollowPageButton } from "./follow-page-button";
import { PageHero } from "./pro-views";

/**
 * Une page pro vue par un membre : qui elle est, ce qu'elle offre, et comment
 * lui écrire. Lit la session : à placer dans un <Suspense>.
 */
export async function PublicPageLoader({ handle }: { handle: string }) {
  if (!HANDLE_PATTERN.test(handle)) notFound();
  const viewer = await getCurrentProfile();
  const page = await getPublicPage(viewer.id, handle);
  if (!page) notFound();
  const acting = await getActingPage(viewer.id);
  const [t, tFollows, format, follow, member, feed] = await Promise.all([
    getTranslations("Pages"),
    getTranslations("Follows"),
    getFormatter(),
    pageFollowState(viewer.id, page.id),
    getCommunityMember(viewer.id),
    listFeed(viewer.id, { pageId: page.id, asPageId: acting?.id ?? null }),
  ]);
  const canWrite = Boolean(member?.joined && !member.suspendedUntil);

  return (
    <div className="flex flex-col gap-6">
      <PageHero page={page}>
        {page.mine ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {tFollows("followers", { count: follow.followers })}
            </p>
            <Button
              asChild
              variant="outline"
              className="identity-page h-11 w-fit"
            >
              <Link href="/pro/edit">
                <Pencil aria-hidden="true" />
                {t("public.edit")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            {/* Écrire à la page : sa boîte, jamais la Messagerie de la personne */}
            <div className="flex min-w-40 flex-1 sm:flex-none">
              <ContactSeller pageId={page.id} label={t("public.contact")} />
            </div>
            {member?.joined ? (
              <>
                <FollowPageButton
                  pageId={page.id}
                  name={page.name}
                  following={follow.following}
                  followers={follow.followers}
                />
                {/* Devenir client : le client choisit ce que la page verra */}
                <ClientRequestArea pageId={page.id} pageName={page.name} />
              </>
            ) : null}
          </div>
        )}
      </PageHero>

      {page.about ? (
        <section
          aria-labelledby="page-about"
          className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
        >
          <h2 id="page-about" className="caps-label text-muted-foreground">
            {t("public.about")}
          </h2>
          <p className="text-pretty break-words whitespace-pre-line">
            {page.about}
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="page-services"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <h2 id="page-services" className="caps-label text-muted-foreground">
          {t("public.services")}
        </h2>
        {page.services.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Store aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t("public.noService")}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {page.services.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="page-posts"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <h2 id="page-posts" className="caps-label text-muted-foreground">
          {t("public.posts")}
        </h2>
        <CommunityFeed
          initialPosts={feed.posts}
          initialCursor={feed.nextCursor}
          now={feed.loadedAt}
          canWrite={canWrite}
          pageId={page.id}
          asPage={acting !== null}
          empty={{
            title: t("public.noPostsTitle"),
            description: t("public.noPosts"),
          }}
        />
      </section>

      <section className="flex flex-col gap-1.5 border-t border-foreground/8 pt-6 text-sm text-muted-foreground">
        {page.website ? (
          <a
            href={page.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex min-h-11 w-fit items-center gap-2 font-medium text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Globe aria-hidden="true" className="size-4" />
            {page.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
        <p>
          {t("public.since", {
            date: format.dateTime(new Date(page.createdAt), {
              month: "long",
              year: "numeric",
            }),
          })}
        </p>
      </section>
    </div>
  );
}

export function PublicPageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="aspect-[3/1] w-full rounded-2xl" />
      <Skeleton className="-mt-10 ml-1 size-20 rounded-2xl" />
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-11 w-40 rounded-lg" />
    </div>
  );
}
