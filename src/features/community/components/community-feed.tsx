"use client";

import { LoaderCircle, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { FeedCursor, FeedPost } from "@/server/community/feed";
import { loadMorePostsAction } from "../actions";
import { PostCard } from "./post-card";
import { ReportDialog } from "./report-dialog";

type CommunityFeedProps = {
  initialPosts: FeedPost[];
  initialCursor: FeedCursor | null;
  /** Heure du serveur au rendu (affichage « il y a 5 minutes »). */
  now: number;
  canWrite: boolean;
};

/** Fil chronologique du Centre, page par page (« Voir plus »). */
export function CommunityFeed({
  initialPosts,
  initialCursor,
  now,
  canWrite,
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
      const page = await loadMorePostsAction(cursor);
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
          title={t("emptyTitle")}
          description={t("emptyDescription")}
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
      ) : posts.length > 0 ? (
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
