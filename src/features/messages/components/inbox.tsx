"use client";

import { MessageCircle, SquarePen, UsersRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/avatar";
import { GroupBadge } from "@/features/groups/components/group-badge";
import { InvitationButtons } from "@/features/groups/components/group-buttons";
import type { GroupTopic } from "@/features/groups/rules";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { InboxPact } from "@/server/messages/pacts";
import type { InboxItem } from "@/server/messages/service";
import { listInboxAction } from "../actions";
import { INBOX_POLL_MS } from "../rules";
import { setUnreadCount } from "../unread-store";
import { PactCarousel } from "./pact-carousel";

/** Groupe privé dont je suis membre ou à qui je suis invité. */
export type PrivateGroupItem = {
  id: string;
  name: string;
  topic: GroupTopic;
  memberCount: number;
  conversationId: string | null;
};

type InboxProps = {
  initial: InboxItem[];
  /** Moment du chargement : base des dates relatives. */
  loadedAt: number;
  groups: PrivateGroupItem[];
  invitations: PrivateGroupItem[];
  /** Pactes à deux en cours, en haut de la Messagerie. */
  pacts: InboxPact[];
  /** Minute actuelle dans mon fuseau, au chargement. */
  nowMinute: number;
  timeZone: string;
};

const TABS = ["chats", "requests", "groups"] as const;

/**
 * Boîte de réception : les pactes en cours (on les fait glisser), puis les
 * discussions, demandes et groupes privés, rafraîchis régulièrement.
 */
export function Inbox({
  initial,
  loadedAt,
  groups,
  invitations,
  pacts,
  nowMinute,
  timeZone,
}: InboxProps) {
  const t = useTranslations("Messages.inbox");
  const [items, setItems] = useState(initial);
  const [now, setNow] = useState(loadedAt);
  const [tab, setTab] = useState<(typeof TABS)[number]>("chats");

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

  const chats = items.filter(
    (item) => item.status === "accepted" && !item.group,
  );
  const requests = items.filter((item) => item.status === "request");
  const groupChats = items.filter(
    (item) => item.status === "accepted" && item.group,
  );
  // Groupes sans aucun message : affichés après les discussions actives
  const quiet = groups.filter(
    (group) => !groupChats.some((item) => item.group?.id === group.id),
  );
  const shown = tab === "chats" ? chats : tab === "requests" ? requests : [];
  const label = (value: (typeof TABS)[number]) =>
    value === "requests" && requests.length > 0
      ? t("requestsCount", { count: requests.length })
      : value === "groups" && invitations.length > 0
        ? t("groupsCount", { count: invitations.length })
        : t(value);

  return (
    <div className="flex flex-col gap-4">
      <PactCarousel pacts={pacts} nowMinute={nowMinute} timeZone={timeZone} />
      <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-2">
        {TABS.map((value) => (
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
                : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {label(value)}
          </button>
        ))}
      </div>

      {tab === "groups" ? (
        <GroupsTab
          chats={groupChats}
          quiet={quiet}
          invitations={invitations}
          now={now}
        />
      ) : shown.length > 0 ? (
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

/** Onglet « Groupes » : invitations, discussions de groupe, puis groupes encore silencieux. */
function GroupsTab({
  chats,
  quiet,
  invitations,
  now,
}: {
  chats: InboxItem[];
  quiet: PrivateGroupItem[];
  invitations: PrivateGroupItem[];
  now: number;
}) {
  const t = useTranslations("Messages.inbox");
  const empty = chats.length === 0 && quiet.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="outline" className="w-fit">
        <Link href={{ pathname: "/groups/new", query: { type: "private" } }}>
          <UsersRound aria-hidden="true" />
          {t("newGroup")}
        </Link>
      </Button>
      {invitations.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h2 className="caps-label text-muted-foreground">
            {t("invitationsTitle")}
          </h2>
          <ul className="flex flex-col">
            {invitations.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-center gap-3 border-b border-foreground/8 py-3"
              >
                <Link
                  href={`/groups/${group.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <GroupBadge topic={group.topic} className="size-12" />
                  <span className="min-w-0 truncate font-semibold">
                    {group.name}
                  </span>
                </Link>
                <InvitationButtons groupId={group.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {empty ? (
        <p className="py-2 text-sm text-muted-foreground">{t("groupsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {chats.map((item) => (
            <li key={item.id}>
              <InboxRow item={item} now={now} />
            </li>
          ))}
          {quiet.map((group) => (
            <li key={group.id}>
              <Link
                href={
                  group.conversationId
                    ? `/messages/${group.conversationId}`
                    : `/groups/${group.id}`
                }
                className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <GroupBadge topic={group.topic} className="size-12" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold">{group.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {t("groupQuiet", { count: group.memberCount })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxRow({ item, now }: { item: InboxItem; now: number }) {
  const t = useTranslations("Messages.inbox");
  const format = useFormatter();
  const author = item.other.displayName ?? item.other.username ?? "";
  // Discussion de groupe : le nom du groupe, et l'auteur devant l'aperçu
  const name = item.group ? item.group.name : author;
  const last = item.lastMessage;
  const text = last.deleted
    ? t("deleted")
    : last.kind === "pact"
      ? t("pact")
      : last.kind === "progress" && !last.body
        ? t("progress")
        : last.kind === "post" && !last.body
          ? t("post")
          : last.kind === "story"
            ? t("story", { text: last.body })
            : !last.body && last.media
              ? t(last.media === "video" ? "video" : "photo")
              : last.body;
  const preview = last.mine
    ? t("you", { text })
    : item.group
      ? t("from", { name: author, text })
      : text;

  return (
    <Link
      href={`/messages/${item.id}`}
      className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {item.group ? (
        <GroupBadge topic={item.group.topic} className="size-12" />
      ) : (
        <Avatar
          name={name}
          url={item.other.avatarUrl}
          className="size-12 text-lg"
        />
      )}
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
            {item.group || item.other.level === null ? null : (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
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
