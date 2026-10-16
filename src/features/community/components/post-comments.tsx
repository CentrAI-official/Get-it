"use client";

import { Flag, LoaderCircle, Send, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FeedComment } from "@/server/community/feed";
import {
  addCommentAction,
  deleteCommentAction,
  loadCommentsAction,
} from "../actions";
import {
  COMMENT_MAX_LENGTH,
  initialCommunityState,
  type CommunityFormState,
} from "../rules";

type PostCommentsProps = {
  postId: string;
  now: number;
  /** Peut commenter (membre, pas suspendu). */
  canWrite: boolean;
  onCountChange: (count: number) => void;
  onReport: (commentId: string) => void;
};

/** Commentaires d'une publication (un seul niveau), chargés à l'ouverture. */
export function PostComments({
  postId,
  now,
  canWrite,
  onCountChange,
  onReport,
}: PostCommentsProps) {
  const t = useTranslations("Community.comments");
  const tErrors = useTranslations("Community.errors");
  const format = useFormatter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [gone, setGone] = useState(false);

  function show(list: FeedComment[] | null) {
    if (list === null) {
      setGone(true);
      return;
    }
    setComments(list);
    onCountChange(list.filter((comment) => !comment.hidden).length);
  }

  async function reload() {
    show(await loadCommentsAction(postId));
  }

  // Après un envoi réussi : formulaire vidé et liste rechargée
  const [state, formAction, pending] = useActionState(
    async (previous: CommunityFormState, formData: FormData) => {
      const result = await addCommentAction(postId, previous, formData);
      if (result.status === "success") {
        formRef.current?.reset();
        await reload();
      }
      return result;
    },
    initialCommunityState,
  );

  // Premier chargement, à l'ouverture des commentaires
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  });
  useEffect(() => {
    let active = true;
    void loadCommentsAction(postId).then((list) => {
      if (active) showRef.current(list);
    });
    return () => {
      active = false;
    };
  }, [postId]);

  async function remove(commentId: string) {
    setComments(
      (current) => current?.filter((c) => c.id !== commentId) ?? null,
    );
    await deleteCommentAction(commentId);
    void reload();
  }

  if (gone) {
    return <p className="text-sm text-muted-foreground">{t("gone")}</p>;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
      {comments === null ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {t("loading")}
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="flex items-start gap-2 rounded-2xl bg-white/[0.04] px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {comment.author.displayName ?? comment.author.username}
                  </span>
                  <span>@{comment.author.username}</span>
                  <time dateTime={comment.createdAt}>
                    {format.relativeTime(new Date(comment.createdAt), now)}
                  </time>
                </p>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {comment.body}
                </p>
                {comment.hidden ? (
                  <p className="text-xs text-muted-foreground">{t("hidden")}</p>
                ) : null}
              </div>
              {comment.mine ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("delete")}
                  onClick={() => void remove(comment.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("report")}
                  onClick={() => onReport(comment.id)}
                  className="text-muted-foreground"
                >
                  <Flag aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <form
          ref={formRef}
          action={formAction}
          noValidate
          className="flex flex-col gap-1.5"
        >
          <div className="flex gap-2">
            <label htmlFor={`${id}-comment`} className="sr-only">
              {t("label")}
            </label>
            <Input
              id={`${id}-comment`}
              name="body"
              defaultValue={
                state.status === "error" ? state.values?.body : undefined
              }
              placeholder={t("placeholder")}
              maxLength={COMMENT_MAX_LENGTH}
              className="h-10 flex-1"
            />
            <Button
              type="submit"
              size="icon-lg"
              variant="secondary"
              aria-label={t("send")}
              disabled={pending}
              className="size-10"
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Send aria-hidden="true" />
              )}
            </Button>
          </div>
          {state.status === "error" && state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(state.error)}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
