"use client";

import {
  Ban,
  EllipsisVertical,
  EyeOff,
  Flag,
  HandHeart,
  LoaderCircle,
  MessageCircle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/server/community/feed";
import {
  blockUserAction,
  deletePostAction,
  setReactionAction,
} from "../actions";
import { requestContactAction } from "@/features/contacts/actions";
import { startConversationAction } from "@/features/messages/actions";
import { useRouter } from "@/i18n/navigation";
import { PostComments } from "./post-comments";
import { PostMedia } from "./post-media";
import { ProgressShare } from "./progress-share";

type PostCardProps = {
  post: FeedPost;
  now: number;
  canWrite: boolean;
  /** La publication disparaît du fil (supprimée, ou auteur bloqué). */
  onRemoved: (filter: { postId?: string; authorId?: string }) => void;
  onReport: (target: { type: "post" | "comment" | "user"; id: string }) => void;
  /** Message d'information (ex. conversation impossible). */
  onNotice: (text: string) => void;
};

/** Publication du fil : auteur, contenu, « Bravo », commentaires et menu. */
export function PostCard({
  post,
  now,
  canWrite,
  onRemoved,
  onReport,
  onNotice,
}: PostCardProps) {
  const t = useTranslations("Community.post");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const [reaction, setReaction] = useState({
    on: post.reacted,
    count: post.reactions,
  });
  const [comments, setComments] = useState(post.comments);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "block" | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const tMessages = useTranslations("Messages.errors");
  const tContacts = useTranslations("Contacts");

  function message() {
    startTransition(async () => {
      const result = await startConversationAction(post.author.id);
      if (result.ok) router.push(`/messages/${result.id}`);
      else onNotice(tMessages(result.error));
    });
  }
  const name = post.author.displayName ?? post.author.username ?? "";
  const handle = `@${post.author.username ?? ""}`;

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

  function toggleReaction() {
    const next = !reaction.on;
    setReaction({ on: next, count: reaction.count + (next ? 1 : -1) });
    startTransition(async () => {
      const result = await setReactionAction(post.id, next);
      if (!result.ok) setReaction(reaction);
    });
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
      className="flex flex-col gap-3 border-t border-white/8 pt-5"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full orb font-heading font-bold uppercase"
        >
          {name.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p
            id={`post-${post.id}`}
            className="flex flex-wrap items-baseline gap-x-2"
          >
            <span className="font-semibold break-words">{name}</span>
            <span className="text-sm text-muted-foreground">{handle}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono">
              {t("level", { level: post.author.level })}
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.createdAt}>
              {format.relativeTime(new Date(post.createdAt), now)}
            </time>
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
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium">
              {t("question")}
            </span>
          ) : null}
          {post.pillar ? (
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted-foreground">
              {tPillars(`${post.pillar}.name`)}
            </span>
          ) : null}
        </div>
      ) : null}

      {post.progress ? <ProgressShare progress={post.progress} /> : null}
      {post.media.length > 0 ? <PostMedia media={post.media} /> : null}
      {post.body ? (
        <p className="break-words whitespace-pre-wrap">{post.body}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {post.mine ? (
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
            <span className="font-mono">{reaction.count}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <MessageCircle aria-hidden="true" />
          {t("comments", { count: comments })}
        </Button>
      </div>

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
