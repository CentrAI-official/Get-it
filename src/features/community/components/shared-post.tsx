"use client";

import { Video } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import type { SharedPost } from "@/server/community/feed";
import { PostMedia } from "./post-media";
import { ProgressHero, ProgressShare } from "./progress-share";

/** En-tête d'une publication citée : photo, nom et @ de l'auteur. */
function SharedAuthor({
  post,
  now,
}: {
  post: SharedPost;
  /** Avec l'heure du serveur : « il y a 2 h » à côté du nom. */
  now?: number;
}) {
  const format = useFormatter();
  const name = post.author.displayName ?? post.author.username ?? "";
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm">
      <Avatar name={name} url={post.author.avatarUrl} className="size-6" />
      <span className="truncate font-semibold">{name}</span>
      <span className="truncate text-muted-foreground">
        @{post.author.username ?? ""}
      </span>
      {now ? (
        <time
          dateTime={post.createdAt}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {format.relativeTime(new Date(post.createdAt), now)}
        </time>
      ) : null}
    </p>
  );
}

/**
 * Publication d'origine d'un partage, dans le fil : citée sous un trait
 * vertical (pas d'encadré), avec ses photos ou sa vidéo.
 */
export function SharedPostEmbed({
  shared,
  now,
}: {
  shared: SharedPost | "unavailable";
  now: number;
}) {
  const t = useTranslations("Community.share");
  if (shared === "unavailable") {
    return (
      <p className="border-l-2 border-white/12 pl-3 text-sm text-muted-foreground italic">
        {t("unavailable")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 border-l-2 border-white/12 pl-3">
      <SharedAuthor post={shared} now={now} />
      {shared.progress ? <ProgressHero progress={shared.progress} /> : null}
      {shared.media.length > 0 ? <PostMedia media={shared.media} /> : null}
      {shared.body ? (
        <p className="break-words whitespace-pre-wrap">{shared.body}</p>
      ) : null}
    </div>
  );
}

/** Aperçu compact d'une publication envoyée dans une conversation. */
export function SharedPostPreview({
  shared,
  className,
}: {
  shared: SharedPost | "unavailable";
  className?: string;
}) {
  const t = useTranslations("Community.share");
  if (shared === "unavailable") {
    return (
      <span className={cn("text-sm text-muted-foreground italic", className)}>
        {t("unavailable")}
      </span>
    );
  }
  const first = shared.media[0];
  const image =
    first?.kind === "image" ? first.url : (first?.posterUrl ?? null);
  return (
    <span className={cn("flex flex-col gap-2", className)}>
      <SharedAuthor post={shared} />
      {image ? (
        <span className="relative block overflow-hidden rounded-2xl bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            loading="lazy"
            className="max-h-56 w-full object-cover"
          />
          {first?.kind === "video" ? (
            <Video
              aria-hidden="true"
              className="absolute bottom-2 left-2 size-4 drop-shadow"
            />
          ) : null}
        </span>
      ) : null}
      {shared.progress && !image ? (
        <ProgressShare progress={shared.progress} />
      ) : null}
      {shared.body ? (
        <span className="line-clamp-3 text-sm break-words whitespace-pre-wrap">
          {shared.body}
        </span>
      ) : null}
    </span>
  );
}
