"use client";

import { MessageCircle, SquarePen } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { InboxItem } from "@/server/messages/service";
import { listInboxAction } from "../actions";
import { INBOX_POLL_MS } from "../rules";
import { setUnreadCount } from "../unread-store";

type InboxProps = {
  initial: InboxItem[];
  /** Moment du chargement : base des dates relatives. */
  loadedAt: number;
};

/** Boîte de réception : discussions et demandes, rafraîchies régulièrement. */
export function Inbox({ initial, loadedAt }: InboxProps) {
  const t = useTranslations("Messages.inbox");
  const [items, setItems] = useState(initial);
  const [now, setNow] = useState(loadedAt);
  const [tab, setTab] = useState<"chats" | "requests">("chats");

  // Rafraîchie dès qu'elle s'affiche (retour d'une conversation refusée,
  // bloquée ou supprimée), puis toutes les 10 secondes
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const next = await listInboxAction().catch(() => null);
      if (!active || !next) return;
      setItems(next);
      setNow(Date.now());
      setUnreadCount(next.filter((item) => item.unread).length);
    }
    void refresh();
    const timer = window.setInterval(refresh, INBOX_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const chats = items.filter((item) => item.status === "accepted");
  const requests = items.filter((item) => item.status === "request");
  const shown = tab === "chats" ? chats : requests;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-2">
        {(["chats", "requests"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === value
                ? "border-primary bg-primary/15 text-foreground"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "requests" && requests.length > 0
              ? t("requestsCount", { count: requests.length })
              : t(value)}
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {shown.map((item) => (
            <li key={item.id}>
              <InboxRow item={item} now={now} />
            </li>
          ))}
        </ul>
      ) : tab === "chats" ? (
        <EmptyState
          icon={MessageCircle}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button asChild>
              <Link href="/messages/new">
                <SquarePen aria-hidden="true" />
                {t("newMessage")}
              </Link>
            </Button>
          }
        />
      ) : (
        <p className="py-2 text-sm text-muted-foreground">
          {t("requestsEmpty")}
        </p>
      )}
    </div>
  );
}

function InboxRow({ item, now }: { item: InboxItem; now: number }) {
  const t = useTranslations("Messages.inbox");
  const format = useFormatter();
  const name = item.other.displayName ?? item.other.username ?? "";
  const last = item.lastMessage;
  const text = last.deleted
    ? t("deleted")
    : last.kind === "pact"
      ? t("pact")
      : last.kind === "progress" && !last.body
        ? t("progress")
        : last.kind === "post" && !last.body
          ? t("post")
          : last.body;
  const preview = last.mine ? t("you", { text }) : text;

  return (
    <Link
      href={`/messages/${item.id}`}
      className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors outline-none hover:bg-white/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Avatar
        name={name}
        url={item.other.avatarUrl}
        className="size-12 text-lg"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                "truncate",
                item.unread ? "font-bold" : "font-semibold",
              )}
            >
              {name}
            </span>
            {item.other.level === null ? null : (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {t("level", { level: item.other.level })}
              </span>
            )}
          </span>
          <time
            dateTime={item.lastMessageAt}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {format.relativeTime(new Date(item.lastMessageAt), now)}
          </time>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              item.unread
                ? "font-medium text-foreground"
                : "text-muted-foreground",
              last.deleted && "italic",
            )}
          >
            {preview}
          </span>
          {item.unread ? (
            <span className="flex shrink-0 items-center">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-primary"
              />
              <span className="sr-only">{t("unread")}</span>
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
