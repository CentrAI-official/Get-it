"use client";

import {
  Ban,
  Bookmark,
  EllipsisVertical,
  EyeOff,
  Flag,
  HandHeart,
  LoaderCircle,
  MessageCircle,
  Repeat2,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/server/community/feed";
import { removeGroupPostAction } from "@/features/groups/actions";
import {
  blockUserAction,
  deletePostAction,
  recordVideoViewAction,
  setPostSavedAction,
} from "../actions";
import { requestContactAction } from "@/features/contacts/actions";
import { startConversationAction } from "@/features/messages/actions";
import { Link, useRouter } from "@/i18n/navigation";
import { useBravo } from "../reaction-store";
import { PostComments } from "./post-comments";
import { PostMedia } from "./post-media";
import { ProgressBadge, ProgressHero } from "./progress-share";
import { ShareDialog } from "./share-dialog";
import { SharedPostEmbed } from "./shared-post";

type PostCardProps = {
  post: FeedPost;
  now: number;
  canWrite: boolean;
  /** La publication disparaît du fil (supprimée, ou auteur bloqué). */
  onRemoved: (filter: { postId?: string; authorId?: string }) => void;
  onReport: (target: { type: "post" | "comment" | "user"; id: string }) => void;
  /** Message d'information (ex. conversation impossible). */
  onNotice: (text: string) => void;
  /** Affichée dans le forum de son groupe : pas de rappel du groupe. */
  inGroup?: boolean;
  /** Créateur ou admin du groupe : « Retirer du groupe ». */
  groupManager?: boolean;
};

/**
 * Publication du fil : auteur, contenu, « Bravo », commentaires et menu. Mode
 * Focus : les photos vont d'un bord à l'autre sur téléphone, « Bravo » et les
 * commentaires sont posés dessus, et un double-tap dit bravo.
 */
export function PostCard({
  post,
  now,
  canWrite,
  onRemoved,
  onReport,
  onNotice,
  inGroup = false,
  groupManager = false,
}: PostCardProps) {
  const t = useTranslations("Community.post");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  // Partagé avec la visionneuse des progrès du jour
  const { reaction, setBravo } = useBravo(post);
  // Chaque double-tap relance l'animation « Bravo » sur la photo
  const [burst, setBurst] = useState(0);
  const [comments, setComments] = useState(post.comments);
  const [views, setViews] = useState(post.videoViews);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "block" | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const tMessages = useTranslations("Messages.errors");
  const tContacts = useTranslations("Contacts");
  const tErrors = useTranslations("Community.errors");
  const [saved, setSaved] = useState(post.saved);
  const [sharing, setSharing] = useState(false);

  /** Enregistrer : la réponse est immédiate, le serveur confirme ensuite. */
  async function toggleSaved() {
    const next = !saved;
    setSaved(next);
    const result = await setPostSavedAction(post.id, next).catch(() => ({
      ok: false as const,
      error: "unexpected" as const,
    }));
    if (result.ok) {
      onNotice(next ? t("savedNotice") : t("unsavedNotice"));
    } else {
      setSaved(!next);
      onNotice(tErrors(result.error));
    }
  }

  function message() {
    startTransition(async () => {
      const result = await startConversationAction(post.author.id);
      if (result.ok) router.push(`/messages/${result.id}`);
      else onNotice(tMessages(result.error));
    });
  }
  const name = post.author.displayName ?? post.author.username ?? "";
  const handle = `@${post.author.username ?? ""}`;
  const profileHref = post.author.username
    ? `/community/members/${post.author.username}`
    : null;

  function addContact() {
    startTransition(async () => {
      const result = await requestContactAction(post.author.id);
      onNotice(
        result.ok
          ? tContacts(`notice.${result.state}`, { handle })
          : tContacts(`errors.${result.error}`),
      );
    });
  }

  const canReact = canWrite && !post.hidden && !post.mine;
  // Photos sans vidéo : affichage immersif, actions posées sur la photo
  const photos =
    post.media.length > 0 && post.media.every((item) => item.kind === "image");

  function toggleReaction() {
    setBravo(!reaction.on);
  }

  function doubleTap() {
    setBurst((count) => count + 1);
    setBravo(true);
  }

  function confirmAction() {
    startTransition(async () => {
      if (confirm === "delete") {
        if (await deletePostAction(post.id)) onRemoved({ postId: post.id });
      } else if (confirm === "block") {
        if (await blockUserAction(post.author.id))
          onRemoved({ authorId: post.author.id });
      }
      setConfirm(null);
    });
  }

  return (
    <article
      aria-labelledby={`post-${post.id}`}
      className="flex flex-col gap-3 border-t border-foreground/8 pt-5"
    >
      <header className="flex items-start gap-3">
        {/* La photo et le nom mènent au profil public de l'auteur */}
        {profileHref ? (
          <Link
            href={profileHref}
            tabIndex={-1}
            aria-hidden="true"
            className="shrink-0"
          >
            <Avatar
              name={name}
              url={post.author.avatarUrl}
              className="size-10"
            />
          </Link>
        ) : (
          <Avatar name={name} url={post.author.avatarUrl} className="size-10" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p
            id={`post-${post.id}`}
            className="flex flex-wrap items-baseline gap-x-2"
          >
            {profileHref ? (
              <Link
                href={profileHref}
                className="rounded-sm font-semibold break-words outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {name}
              </Link>
            ) : (
              <span className="font-semibold break-words">{name}</span>
            )}
            <span className="text-sm text-muted-foreground">{handle}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {post.author.level === null ? null : (
              <>
                <span className="tabular-nums">
                  {t("level", { level: post.author.level })}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <time dateTime={post.createdAt}>
              {format.relativeTime(new Date(post.createdAt), now)}
            </time>
            {post.group && !inGroup ? (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/groups/${post.group.id}`}
                  className="rounded-sm hover:text-foreground hover:underline"
                >
                  {t("inGroup", { group: post.group.name })}
                </Link>
              </>
            ) : null}
            {post.shared ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <Repeat2 aria-hidden="true" className="size-3.5" />
                  {t("sharedLabel")}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("menu")}
              className="text-muted-foreground"
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {groupManager && !post.mine ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  startTransition(async () => {
                    const result = await removeGroupPostAction(post.id);
                    if (result.ok) onRemoved({ postId: post.id });
                  })
                }
              >
                <Trash2 aria-hidden="true" />
                {t("removeFromGroup")}
              </DropdownMenuItem>
            ) : null}
            {post.mine ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirm("delete")}
              >
                <Trash2 aria-hidden="true" />
                {t("delete")}
              </DropdownMenuItem>
            ) : (
              <>
                {canWrite ? (
                  <>
                    <DropdownMenuItem onSelect={message}>
                      <MessageCircle aria-hidden="true" />
                      {t("message")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={addContact}>
                      <UserPlus aria-hidden="true" />
                      {tContacts("addHandle", { handle })}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => onReport({ type: "post", id: post.id })}
                >
                  <Flag aria-hidden="true" />
                  {t("reportPost")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    onReport({ type: "user", id: post.author.id })
                  }
                >
                  <Flag aria-hidden="true" />
                  {t("reportUser", { handle })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirm("block")}
                >
                  <Ban aria-hidden="true" />
                  {t("block", { handle })}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {post.hidden ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("hidden")}
        </p>
      ) : null}

      {post.kind === "question" || post.pillar ? (
        <div className="flex flex-wrap gap-2">
          {post.kind === "question" ? (
            <span className="rounded-full bg-foreground/8 px-2.5 py-1 text-xs font-medium">
              {t("question")}
            </span>
          ) : null}
          {post.pillar ? (
            <span className="rounded-full border border-foreground/10 px-2.5 py-1 text-xs text-muted-foreground">
              {tPillars(`${post.pillar}.name`)}
            </span>
          ) : null}
        </div>
      ) : null}

      {post.progress && !photos ? (
        <ProgressHero progress={post.progress} />
      ) : null}
      {post.media.length > 0 ? (
        // Bord à bord sur téléphone (la page a une marge de 1 rem)
        <div className="relative -mx-4 sm:mx-0">
          <PostMedia
            media={post.media}
            className="rounded-none sm:rounded-2xl"
            onDoubleTap={photos && canReact ? doubleTap : undefined}
            videoViews={views}
            onVideoViewed={
              post.mine
                ? undefined
                : () =>
                    void recordVideoViewAction(post.id).then((counted) => {
                      if (counted) setViews((current) => current + 1);
                    })
            }
          />
          {photos ? (
            <>
              {burst > 0 ? (
                // Retiré à la fin de l'animation ; jamais affiché si les animations sont réduites
                <span
                  key={burst}
                  aria-hidden="true"
                  onAnimationEnd={() => setBurst(0)}
                  className="pointer-events-none absolute inset-0 m-auto hidden size-28 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 ring-6 ring-black/40 motion-safe:flex motion-safe:animate-bravo-burst"
                >
                  <HandHeart className="size-14" />
                </span>
              ) : null}
              {post.progress ? (
                <ProgressBadge
                  progress={post.progress}
                  className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)]"
                />
              ) : null}
              <div className="dark absolute right-3 bottom-3 flex flex-col items-center gap-3 text-xs font-bold tabular-nums [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
                {post.mine ? (
                  <span className="flex flex-col items-center gap-1">
                    <span className="flex size-12 items-center justify-center rounded-full bg-black/70 backdrop-blur-sm">
                      <HandHeart aria-hidden="true" className="size-6" />
                    </span>
                    <span className="sr-only">
                      {t("bravoCount", { count: reaction.count })}
                    </span>
                    <span aria-hidden="true">{reaction.count}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-pressed={reaction.on}
                    disabled={!canReact}
                    onClick={toggleReaction}
                    className="group flex flex-col items-center gap-1 outline-none disabled:opacity-60"
                  >
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full backdrop-blur-sm transition-colors group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
                        reaction.on
                          ? "bg-primary text-primary-foreground ring-2 ring-black/60"
                          : "bg-black/70",
                      )}
                    >
                      <HandHeart aria-hidden="true" className="size-6" />
                    </span>
                    <span className="sr-only">{t("bravo")}</span>
                    <span>{reaction.count}</span>
                  </button>
                )}
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpen(!open)}
                  className="group flex flex-col items-center gap-1 outline-none"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-black/70 backdrop-blur-sm group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                    <MessageCircle aria-hidden="true" className="size-6" />
                  </span>
                  <span className="sr-only">
                    {t("comments", { count: comments })}
                  </span>
                  <span aria-hidden="true">{comments}</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {post.body ? (
        <p className="break-words whitespace-pre-wrap">{post.body}</p>
      ) : null}
      {post.shared ? <SharedPostEmbed shared={post.shared} now={now} /> : null}

      {/* Sur une photo, « Bravo » et les commentaires sont posés dessus */}
      <div className="flex flex-wrap items-center gap-2">
        {photos ? null : post.mine ? (
          <span className="flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
            <HandHeart aria-hidden="true" className="size-4" />
            {t("bravoCount", { count: reaction.count })}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={reaction.on}
            disabled={!canWrite || post.hidden}
            onClick={toggleReaction}
            className={cn(
              reaction.on && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
          >
            <HandHeart aria-hidden="true" />
            {t("bravo")}
            <span className="tabular-nums">{reaction.count}</span>
          </Button>
        )}
        {photos ? null : (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <MessageCircle aria-hidden="true" />
            {t("comments", { count: comments })}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("share")}
          onClick={() => setSharing(true)}
        >
          <Send aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-pressed={saved}
          aria-label={t("save")}
          onClick={toggleSaved}
          className={cn("ml-auto", saved && "text-primary")}
        >
          <Bookmark
            aria-hidden="true"
            className={cn(saved && "fill-current")}
          />
        </Button>
      </div>

      <ShareDialog
        post={post}
        open={sharing}
        onOpenChange={setSharing}
        canWrite={canWrite}
        onNotice={onNotice}
      />

      {open ? (
        <PostComments
          postId={post.id}
          now={now}
          canWrite={canWrite && !post.hidden}
          onCountChange={setComments}
          onReport={(commentId) => onReport({ type: "comment", id: commentId })}
        />
      ) : null}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(value) => !value && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "block"
                ? t("blockTitle", { handle })
                : t("deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "block"
                ? t("blockDescription")
                : t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={confirmAction}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {confirm === "block" ? t("blockConfirm") : t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
