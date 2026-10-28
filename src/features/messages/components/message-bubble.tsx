"use client";

import { EllipsisVertical, Flag, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PostMedia } from "@/features/community/components/post-media";
import { ProgressShare } from "@/features/community/components/progress-share";
import { SharedPostPreview } from "@/features/community/components/shared-post";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/server/messages/service";
import { REACTION_EMOJI, REACTIONS, type Reaction } from "../rules";

type MessageBubbleProps = {
  message: ChatMessage & { pending?: boolean };
  /** Prénom de l'autre personne (lecteurs d'écran). */
  otherName: string;
  /** Dernier message d'un groupe : l'heure s'affiche dessous. */
  groupEnd: boolean;
  timeZone: string;
  selected: boolean;
  onSelect: () => void;
  onReact: (kind: Reaction | null) => void;
  onDelete: () => void;
  onReport: () => void;
};

/**
 * Une bulle : toucher la bulle ouvre les réactions (messages de l'autre) et
 * les options (supprimer le sien, signaler celui de l'autre).
 */
export function MessageBubble({
  message,
  otherName,
  groupEnd,
  timeZone,
  selected,
  onSelect,
  onReact,
  onDelete,
  onReport,
}: MessageBubbleProps) {
  const t = useTranslations("Messages.conversation");
  const tReactions = useTranslations("Messages.reactions");
  const format = useFormatter();
  const mine = message.mine;
  const reaction = message.reactions[0];
  const myReaction = message.reactions.find((item) => item.mine)?.kind ?? null;
  const interactive = !message.deleted && !message.pending;
  const hasMedia = message.media.length > 0 && !message.deleted;
  // Photos sans texte : un petit bouton remplace la bulle (réactions, options)
  const mediaOnly =
    hasMedia && !message.body && !message.progress && !message.post;

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        mine ? "items-end" : "items-start",
        groupEnd ? "mb-3" : "mb-0.5",
      )}
    >
      {/* Les photos se touchent pour s'agrandir : hors du bouton de la bulle */}
      {hasMedia ? (
        <div
          className={cn(
            "w-64 max-w-[82%] sm:w-80",
            message.pending && "opacity-60",
          )}
        >
          <PostMedia media={message.media} className="rounded-3xl" />
        </div>
      ) : null}
      {mediaOnly ? (
        <button
          type="button"
          disabled={!interactive}
          aria-expanded={interactive ? selected : undefined}
          aria-label={t("options")}
          onClick={onSelect}
          className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <EllipsisVertical aria-hidden="true" className="size-4" />
          {reaction ? (
            <span
              className={cn(
                "absolute -bottom-2 flex size-6 items-center justify-center rounded-full border border-foreground/10 bg-raised text-xs",
                mine ? "-left-5" : "-right-5",
              )}
            >
              <span aria-hidden="true">{REACTION_EMOJI[reaction.kind]}</span>
              <span className="sr-only">{tReactions(reaction.kind)}</span>
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          disabled={!interactive}
          aria-expanded={interactive ? selected : undefined}
          onClick={onSelect}
          className={cn(
            "relative max-w-[82%] rounded-3xl px-4 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-[70%]",
            mine
              ? "rounded-br-lg bg-foreground/[0.14]"
              : "rounded-bl-lg bg-foreground/[0.05] ring-1 ring-foreground/10",
            message.deleted &&
              "bg-transparent text-muted-foreground italic ring-1 ring-foreground/10",
            message.pending && "opacity-60",
            reaction && "mb-3",
          )}
        >
          <span className="sr-only">{mine ? t("you") : otherName} : </span>
          {message.deleted ? (
            t("deleted")
          ) : (
            <span className="flex flex-col gap-2">
              {message.progress ? (
                <ProgressShare progress={message.progress} className="-mx-1" />
              ) : null}
              {message.post ? (
                <SharedPostPreview shared={message.post} className="min-w-52" />
              ) : null}
              {message.body ? (
                <span className="break-words whitespace-pre-wrap">
                  {message.body}
                </span>
              ) : null}
            </span>
          )}
          {reaction ? (
            <span
              className={cn(
                "absolute -bottom-3 flex size-7 items-center justify-center rounded-full border border-foreground/10 bg-raised text-sm",
                mine ? "left-2" : "right-2",
              )}
            >
              <span aria-hidden="true">{REACTION_EMOJI[reaction.kind]}</span>
              <span className="sr-only">{tReactions(reaction.kind)}</span>
            </span>
          ) : null}
        </button>
      )}

      {/* Le lien reste hors de la bulle (un bouton ne contient pas de lien) */}
      {message.post && message.post !== "unavailable" && !message.pending ? (
        <Link
          href={`/community/posts/${message.post.id}`}
          className="rounded-md px-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("viewPost")}
        </Link>
      ) : null}

      {selected && interactive ? (
        <div
          role="group"
          aria-label={t("options")}
          className={cn(
            "flex flex-wrap items-center gap-1 rounded-full border border-foreground/10 bg-raised p-1",
            reaction && "mt-1",
          )}
        >
          {!mine
            ? REACTIONS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={myReaction === kind}
                  aria-label={tReactions(kind)}
                  title={tReactions(kind)}
                  onClick={() => onReact(myReaction === kind ? null : kind)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-lg transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50",
                    myReaction === kind && "bg-primary/20 ring-1 ring-primary",
                  )}
                >
                  <span aria-hidden="true">{REACTION_EMOJI[kind]}</span>
                </button>
              ))
            : null}
          <button
            type="button"
            onClick={mine ? onDelete : onReport}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {mine ? (
              <Trash2 aria-hidden="true" className="size-4" />
            ) : (
              <Flag aria-hidden="true" className="size-4" />
            )}
            {mine ? t("deleteMessage") : t("reportMessage")}
          </button>
        </div>
      ) : null}

      {groupEnd ? (
        <time
          dateTime={message.createdAt}
          className={cn(
            "px-2 text-[0.7rem] text-muted-foreground",
            reaction && !selected && "mt-1",
          )}
        >
          {message.pending
            ? t("sending")
            : format.dateTime(new Date(message.createdAt), {
                hour: "numeric",
                minute: "2-digit",
                timeZone,
              })}
        </time>
      ) : null}
    </div>
  );
}
