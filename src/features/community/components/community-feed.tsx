"use client";

import { LoaderCircle, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { FeedCursor, FeedPost } from "@/server/community/feed";
import { loadMorePostsAction, loadMoreSavedAction } from "../actions";
import { PostCard } from "./post-card";
import { ReportDialog } from "./report-dialog";

type CommunityFeedProps = {
  initialPosts: FeedPost[];
  initialCursor: FeedCursor | null;
  /** Heure du serveur au rendu (affichage « il y a 5 minutes »). */
  now: number;
  canWrite: boolean;
  /** Seulement les publications de cette personne (profil, onglet Publications). */
  authorId?: string;
  /** Textes de l'état vide, à la place de ceux du fil. */
  empty?: { title: string; description: string };
  /** Mes publications enregistrées (Profil › Publications › Enregistrées). */
  saved?: boolean;
  /** Une seule publication (lien partagé) : pas de « Tu as tout vu ». */
  single?: boolean;
};

/** Fil chronologique du Centre, page par page (« Voir plus »). */
export function CommunityFeed({
  initialPosts,
  initialCursor,
  now,
  canWrite,
  authorId,
  empty,
  saved = false,
  single = false,
}: CommunityFeedProps) {
  const t = useTranslations("Community.feed");
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, startLoading] = useTransition();
  const [reportTarget, setReportTarget] = useState<{
    type: "post" | "comment" | "user";
    id: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function loadMore() {
    if (!cursor) return;
    startLoading(async () => {
      const page = saved
        ? await loadMoreSavedAction(cursor)
        : await loadMorePostsAction(cursor, authorId);
      setPosts((current) => [
        ...current,
        ...page.posts.filter((post) => !current.some((p) => p.id === post.id)),
      ]);
      setCursor(page.nextCursor);
    });
  }

  function removed({
    postId,
    authorId,
  }: {
    postId?: string;
    authorId?: string;
  }) {
    setPosts((current) =>
      current.filter(
        (post) => post.id !== postId && post.author.id !== authorId,
      ),
    );
    setNotice(authorId ? t("blocked") : t("deleted"));
  }

  return (
    <section aria-label={t("label")} className="flex flex-col gap-5">
      <p role="status" className={notice ? "text-sm text-primary" : "sr-only"}>
        {notice}
      </p>
      {posts.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={empty?.title ?? t("emptyTitle")}
          description={empty?.description ?? t("emptyDescription")}
        />
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            now={now}
            canWrite={canWrite}
            onRemoved={removed}
            onReport={setReportTarget}
            onNotice={setNotice}
          />
        ))
      )}
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
      ) : posts.length > 0 && !single ? (
        <p className="text-center text-sm text-muted-foreground">{t("end")}</p>
      ) : null}
      <ReportDialog
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onReported={() => setNotice(t("reported"))}
      />
    </section>
  );
}
