"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type {
  ModerationDecision,
  ReportedItem,
} from "@/server/community/moderation";
import { moderateAction } from "../actions";

/** Signalements ouverts et décisions de la modération (§44). */
export function ModerationQueue({ items }: { items: ReportedItem[] }) {
  const t = useTranslations("Community.moderation");

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={`${item.target.type}:${item.target.id}`}>
          <ReportedCard item={item} />
        </li>
      ))}
    </ul>
  );
}

function ReportedCard({ item }: { item: ReportedItem }) {
  const t = useTranslations("Community.moderation");
  const tReasons = useTranslations("Community.report.reasons");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const handle = `@${item.author.username ?? ""}`;

  const counts = new Map<string, number>();
  for (const report of item.reports) {
    counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
  }

  function decide(decision: ModerationDecision) {
    startTransition(async () => {
      await moderateAction(item.target, decision);
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-3xl glass p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading font-bold">
          {t(`targets.${item.target.type}`)} ·{" "}
          {item.author.displayName ?? handle}{" "}
          <span className="font-normal text-muted-foreground">{handle}</span>
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {t("count", { count: item.reports.length })}
        </span>
      </div>
      {item.status ? (
        <p className="text-xs text-muted-foreground">
          {t(`status.${item.status}`)}
        </p>
      ) : null}
      {item.body ? (
        <blockquote className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm break-words whitespace-pre-wrap">
          {item.body}
        </blockquote>
      ) : null}
      <ul className="flex flex-wrap gap-2">
        {[...counts].map(([reason, count]) => (
          <li
            key={reason}
            className="rounded-full bg-white/8 px-2.5 py-1 text-xs"
          >
            {tReasons(reason as "spam")} × {count}
          </li>
        ))}
      </ul>
      {item.reports.some((report) => report.details) ? (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {item.reports
            .filter((report) => report.details)
            .map((report, index) => (
              <li key={index}>« {report.details} »</li>
            ))}
        </ul>
      ) : null}
      {item.author.suspendedUntil ? (
        <p className="text-sm text-destructive">
          {t("suspendedUntil", {
            date: format.dateTime(new Date(item.author.suspendedUntil), {
              dateStyle: "long",
            }),
          })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {item.target.type === "post" || item.target.type === "comment" ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => decide("remove")}
            >
              {t("remove")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => decide("restore")}
            >
              {t("restore")}
            </Button>
          </>
        ) : (
          <>
            {item.target.type === "message" && item.status !== "removed" ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => decide("remove")}
              >
                {t("remove")}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => decide("dismiss")}
            >
              {t("dismiss")}
            </Button>
          </>
        )}
        {item.author.suspendedUntil ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => decide("unsuspend")}
          >
            {t("unsuspend")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => decide("suspend")}
          >
            {t("suspend", { handle })}
          </Button>
        )}
        {pending ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin self-center text-muted-foreground"
          />
        ) : null}
      </div>
    </article>
  );
}
