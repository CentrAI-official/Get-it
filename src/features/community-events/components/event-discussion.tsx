"use client";

import { Flag, LoaderCircle, Send, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { ProfileLink } from "@/components/profile-link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/features/community/components/report-dialog";
import { currentIdentity } from "@/features/identity/client";
import { PageLogo } from "@/features/pages/components/page-logo";
import type { EventComment } from "@/server/community-events/service";
import { addEventCommentAction, deleteEventCommentAction } from "../actions";
import { COMMUNITY_EVENT_LIMITS, type CommunityEventError } from "../rules";

/**
 * La discussion d'un événement : questions, covoiturage… Le plus ancien en
 * haut, la case pour écrire en bas. Au nom de sa page en mode page.
 */
export function EventDiscussion({
  eventId,
  comments,
  now,
  canWrite,
  asPage,
}: {
  eventId: string;
  comments: EventComment[];
  /** Heure du serveur au rendu (« il y a 5 minutes »). */
  now: number;
  /** Membre du Centre, non suspendu. */
  canWrite: boolean;
  /** Au nom de cette page (mode page). */
  asPage: { name: string; logoUrl: string | null } | null;
}) {
  const t = useTranslations("CommunityEvents.discussion");
  const tErrors = useTranslations("CommunityEvents.errors");
  const format = useFormatter();
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<CommunityEventError | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await addEventCommentAction(
        eventId,
        body,
        currentIdentity(),
      );
      if (result.ok) setBody("");
      else setError(result.error);
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
    >
      <h2 id={`${id}-title`} className="caps-label text-muted-foreground">
        {t("title", { count: comments.length })}
      </h2>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="flex gap-3 border-b border-foreground/8 py-3"
            >
              <ProfileLink
                username={comment.author.username}
                pageHandle={comment.author.pageHandle}
                className="shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {comment.author.pageHandle ? (
                  <PageLogo
                    name={comment.author.name}
                    url={comment.author.avatarUrl}
                    className="size-9"
                  />
                ) : (
                  <Avatar
                    name={comment.author.name}
                    url={comment.author.avatarUrl}
                    className="size-9 text-sm"
                  />
                )}
              </ProfileLink>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <ProfileLink
                    username={comment.author.username}
                    pageHandle={comment.author.pageHandle}
                    className="font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {comment.author.name}
                  </ProfileLink>
                  <span className="text-xs text-muted-foreground">
                    {format.relativeTime(new Date(comment.createdAt), now)}
                  </span>
                </p>
                {comment.hidden ? (
                  <p className="text-xs text-muted-foreground">{t("hidden")}</p>
                ) : null}
                <p className="text-sm break-words whitespace-pre-line">
                  {comment.body}
                </p>
              </div>
              <div className="flex shrink-0 items-start">
                {comment.removable ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("delete")}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteEventCommentAction(comment.id);
                      })
                    }
                    className="text-muted-foreground"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
                {!comment.mine && canWrite ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("report")}
                    disabled={reported.has(comment.id)}
                    onClick={() => setReport(comment.id)}
                    className="text-muted-foreground"
                  >
                    <Flag aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) send();
          }}
        >
          <label htmlFor={`${id}-body`} className="sr-only">
            {t("label")}
          </label>
          <div className="flex items-end gap-2">
            {asPage ? (
              <PageLogo
                name={asPage.name}
                url={asPage.logoUrl}
                className="mb-1 size-9 shrink-0"
              />
            ) : null}
            <Textarea
              id={`${id}-body`}
              value={body}
              onChange={(change) => setBody(change.target.value)}
              maxLength={COMMUNITY_EVENT_LIMITS.comment}
              rows={2}
              placeholder={
                asPage
                  ? t("placeholderPage", { page: asPage.name })
                  : t("placeholder")
              }
              className="min-h-11 flex-1 rounded-2xl"
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label={t("send")}
              disabled={pending || !body.trim()}
              className="shrink-0 rounded-full"
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Send aria-hidden="true" />
              )}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          ) : null}
        </form>
      ) : null}

      <ReportDialog
        target={report ? { type: "eventComment", id: report } : null}
        onClose={() => setReport(null)}
        onReported={() => {
          if (report) setReported((all) => new Set(all).add(report));
          setReport(null);
        }}
      />
    </section>
  );
}
