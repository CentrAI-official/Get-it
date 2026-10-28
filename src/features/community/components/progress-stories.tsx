"use client";

import { ChevronLeft, ChevronRight, HandHeart, UserPlus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { ringBackground } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { openDayPanel, useDayPanel } from "@/features/today/day-panel-store";
import { ratio } from "@/features/today/day-plan";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/server/community/feed";
import type { ProgressStory } from "@/server/community/stories";
import { useBravo } from "../reaction-store";
import { markStorySeen, useSeenStories } from "../stories-seen-store";
import { PostMedia } from "./post-media";
import { ProgressHero } from "./progress-share";

/** Une personne et l'un de ses progrès, ouverts dans la visionneuse. */
type Opened = { story: number; post: number };

const BUBBLE =
  "flex w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type ProgressStoriesProps = {
  stories: ProgressStory[];
  /** Mon nom et ma photo, dans la bulle « Ta journée ». */
  name: string;
  avatarUrl: string | null;
  canWrite: boolean;
  /** Heure du serveur au rendu (« il y a 2 h »). */
  now: number;
};

/**
 * « Progrès du jour » (mode Focus du Centre) : ma journée en premier, puis les
 * contacts qui ont partagé un progrès depuis 24 heures. Anneau orange : pas
 * encore vu sur cet appareil.
 */
export function ProgressStories({
  stories,
  name,
  avatarUrl,
  canWrite,
  now,
}: ProgressStoriesProps) {
  const t = useTranslations("Community.stories");
  const { progress } = useDayPanel();
  const seen = useSeenStories();
  const [opened, setOpened] = useState<Opened | null>(null);
  const day = progress ?? { done: 0, total: 0 };

  /** Premier progrès pas encore vu de cette personne (sinon le premier). */
  function firstUnseen(index: number) {
    const posts = stories[index]?.posts ?? [];
    const position = posts.findIndex((post) => !seen.has(post.id));
    return position === -1 ? 0 : position;
  }

  return (
    <section aria-label={t("label")} className="-mx-4 sm:mx-0">
      <ul className="flex [scrollbar-width:none] gap-3 overflow-x-auto px-4 pt-1 pb-2 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => openDayPanel()}
            aria-label={day.total > 0 ? t("myDayLabel", day) : t("myDayOpen")}
            className={BUBBLE}
          >
            <span className="relative">
              <span
                className="flex size-16 rounded-full p-[3px]"
                style={{ background: ringBackground(ratio(day)) }}
              >
                <span className="flex size-full rounded-full bg-background p-[2px]">
                  <Avatar
                    name={name}
                    url={avatarUrl}
                    className="size-full text-lg"
                  />
                </span>
              </span>
              {day.total > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -bottom-1 rounded-full border-2 border-background bg-primary px-1.5 text-[10px] leading-4 font-bold text-primary-foreground tabular-nums"
                >
                  {t("badge", day)}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate text-xs font-semibold">
              {t("myDay")}
            </span>
          </button>
        </li>

        {stories.map((story, index) => {
          const unseen = story.posts.some((post) => !seen.has(post.id));
          const who = story.author.displayName ?? story.author.username ?? "";
          return (
            <li key={story.author.id} className="shrink-0">
              <button
                type="button"
                onClick={() =>
                  setOpened({ story: index, post: firstUnseen(index) })
                }
                aria-label={
                  unseen
                    ? t("openNew", { name: who })
                    : t("open", { name: who })
                }
                className={BUBBLE}
              >
                <span
                  className={cn(
                    "flex size-16 rounded-full p-[3px] transition-colors duration-300",
                    unseen ? "bg-primary" : "bg-foreground/15",
                  )}
                >
                  <span className="flex size-full rounded-full bg-background p-[2px]">
                    <Avatar
                      name={who}
                      url={story.author.avatarUrl}
                      className="size-full text-lg"
                    />
                  </span>
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-xs",
                    unseen
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {who}
                </span>
              </button>
            </li>
          );
        })}

        {stories.length === 0 ? (
          // Sans contacts actifs aujourd'hui : un chemin pour en ajouter
          <li className="shrink-0">
            <Link
              href="/messages/contacts"
              aria-label={t("addContactsLabel")}
              className={BUBBLE}
            >
              <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-foreground/20 text-muted-foreground">
                <UserPlus aria-hidden="true" className="size-6" />
              </span>
              <span className="max-w-full truncate text-xs text-muted-foreground">
                {t("addContacts")}
              </span>
            </Link>
          </li>
        ) : null}
      </ul>

      <StoryViewer
        stories={stories}
        opened={opened}
        onChange={setOpened}
        firstUnseen={firstUnseen}
        canWrite={canWrite}
        now={now}
      />
    </section>
  );
}

type StoryViewerProps = {
  stories: ProgressStory[];
  opened: Opened | null;
  onChange: (opened: Opened | null) => void;
  firstUnseen: (story: number) => number;
  canWrite: boolean;
  now: number;
};

/** Visionneuse plein écran : un progrès à la fois, « Bravo » en un geste. */
function StoryViewer({
  stories,
  opened,
  onChange,
  firstUnseen,
  canWrite,
  now,
}: StoryViewerProps) {
  const t = useTranslations("Community.stories");
  const format = useFormatter();
  const story = opened ? stories[opened.story] : undefined;
  const post = opened && story ? story.posts[opened.post] : undefined;
  const postId = post?.id;

  // Un progrès affiché est vu : son anneau devient gris
  useEffect(() => {
    if (postId) markStorySeen(postId);
  }, [postId]);

  function next() {
    if (!opened || !story) return;
    if (opened.post < story.posts.length - 1) {
      onChange({ story: opened.story, post: opened.post + 1 });
    } else if (opened.story < stories.length - 1) {
      onChange({
        story: opened.story + 1,
        post: firstUnseen(opened.story + 1),
      });
    } else {
      onChange(null);
    }
  }

  function previous() {
    if (!opened) return;
    if (opened.post > 0) {
      onChange({ story: opened.story, post: opened.post - 1 });
    } else if (opened.story > 0) {
      const before = opened.story - 1;
      onChange({
        story: before,
        post: (stories[before]?.posts.length ?? 1) - 1,
      });
    }
  }

  const who = story
    ? (story.author.displayName ?? story.author.username ?? "")
    : "";
  const isFirst = opened?.story === 0 && opened.post === 0;

  return (
    <Dialog
      open={post !== undefined}
      onOpenChange={(value) => !value && onChange(null)}
    >
      <DialogContent
        closeLabel={t("close")}
        // Plein écran sur téléphone, fenêtre haute sur ordinateur
        className="dark inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-4 rounded-none bg-black p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(52rem,calc(100dvh-4rem))] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1"
      >
        {story && post && opened ? (
          <>
            <ol
              aria-hidden="true"
              className="mr-10 grid gap-1 pt-2"
              style={{
                gridTemplateColumns: `repeat(${story.posts.length}, minmax(0, 1fr))`,
              }}
            >
              {story.posts.map((item, index) => (
                <li
                  key={item.id}
                  className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    index < opened.post
                      ? "bg-foreground"
                      : index === opened.post
                        ? "bg-primary"
                        : "bg-foreground/20",
                  )}
                />
              ))}
            </ol>

            <header className="mr-10 flex items-center gap-3">
              <Avatar
                name={who}
                url={story.author.avatarUrl}
                className="size-10"
              />
              <div className="flex min-w-0 flex-col">
                <DialogTitle className="truncate text-base">{who}</DialogTitle>
                <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <time dateTime={post.createdAt}>
                    {format.relativeTime(new Date(post.createdAt), now)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("position", {
                      n: opened.post + 1,
                      total: story.posts.length,
                    })}
                  </span>
                </p>
              </div>
            </header>
            <DialogDescription className="sr-only">
              {t("viewerDescription", { name: who })}
            </DialogDescription>

            {/* Nouveau contenu à chaque progrès : il glisse depuis la droite */}
            <div
              key={post.id}
              className="-mx-4 flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto px-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-right-8"
            >
              {post.progress ? <ProgressHero progress={post.progress} /> : null}
              {post.media.length > 0 ? <PostMedia media={post.media} /> : null}
              {post.body ? (
                <p className="text-lg break-words whitespace-pre-wrap">
                  {post.body}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                aria-label={t("previous")}
                disabled={isFirst}
                onClick={previous}
                className="size-14 rounded-full"
              >
                <ChevronLeft aria-hidden="true" className="size-6" />
              </Button>
              <StoryBravo post={post} canWrite={canWrite} />
              <Button
                type="button"
                variant="secondary"
                aria-label={t("next")}
                onClick={next}
                className="size-14 rounded-full"
              >
                <ChevronRight aria-hidden="true" className="size-6" />
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** « Bravo » d'un progrès du jour, synchronisé avec la même publication dans le fil. */
function StoryBravo({ post, canWrite }: { post: FeedPost; canWrite: boolean }) {
  const t = useTranslations("Community.post");
  const { reaction, setBravo } = useBravo(post);
  const canReact = canWrite && !post.mine && !post.hidden;

  return (
    <Button
      type="button"
      variant={reaction.on ? "default" : "secondary"}
      aria-pressed={reaction.on}
      disabled={!canReact}
      onClick={() => setBravo(!reaction.on)}
      className={cn(
        "h-14 flex-1 rounded-full text-base font-bold",
        reaction.on && "glow-primary",
      )}
    >
      <HandHeart aria-hidden="true" className="size-5" />
      {t("bravo")}
      <span className="tabular-nums">{reaction.count}</span>
    </Button>
  );
}
