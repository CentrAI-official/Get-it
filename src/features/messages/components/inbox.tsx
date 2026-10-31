"use client";

import {
  LoaderCircle,
  MessageCircle,
  SquarePen,
  UsersRound,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/avatar";
import { GroupBadge } from "@/features/groups/components/group-badge";
import { InvitationButtons } from "@/features/groups/components/group-buttons";
import type { GroupTopic } from "@/features/groups/rules";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { InboxPact } from "@/server/messages/pacts";
import type { InboxItem, OnlineContact } from "@/server/messages/service";
import { listInboxAction, startConversationAction } from "../actions";
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
  /** Contacts en ligne (filtre « En ligne »). */
  initialOnline: OnlineContact[];
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
  initialOnline,
  loadedAt,
  groups,
  invitations,
  pacts,
  nowMinute,
  timeZone,
}: InboxProps) {
  const t = useTranslations("Messages.inbox");
  const [items, setItems] = useState(initial);
  const [online, setOnline] = useState(initialOnline);
  const [now, setNow] = useState(loadedAt);
  const [tab, setTab] = useState<(typeof TABS)[number]>("chats");
  // Seulement les contacts en ligne (comme le rond vert d'Instagram)
  const [onlineOnly, setOnlineOnly] = useState(false);

  // Rafraîchie dès qu'elle s'affiche (retour d'une conversation refusée,
  // bloquée ou supprimée), puis toutes les 10 secondes
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const next = await listInboxAction().catch(() => null);
      if (!active || !next) return;
      setItems(next.items);
      setOnline(next.online);
      setNow(Date.now());
      setUnreadCount(next.items.filter((item) => item.unread).length);
    }
    void refresh();
    const timer = window.setInterval(refresh, INBOX_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Discussions : à deux et de groupe mêlées ; « Groupes » ne montre que les groupes
  const chats = items.filter((item) => item.status === "accepted");
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
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-2">
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value);
                setOnlineOnly(false);
              }}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === value && !onlineOnly
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {label(value)}
            </button>
          ))}
        </div>
        {/* Filtre : seulement les contacts en ligne (hors des onglets) */}
        <button
          type="button"
          aria-pressed={onlineOnly}
          onClick={() => {
            setOnlineOnly(!onlineOnly);
            setTab("chats");
          }}
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            onlineOnly
              ? "border-primary bg-primary/15 text-foreground"
              : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
          )}
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          {t("onlineCount", { count: online.length })}
        </button>
      </div>

      {onlineOnly ? (
        online.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {online.map((contact) => (
              <li key={contact.person.id}>
                <OnlineRow
                  contact={contact}
                  item={items.find(
                    (item) =>
                      !item.group && item.other.id === contact.person.id,
                  )}
                  now={now}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            {t("onlineEmpty")}
          </p>
        )
      ) : tab === "groups" ? (
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
          online={item.online}
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
            {item.online ? (
              <span className="sr-only">{t("online")}</span>
            ) : null}
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

/**
 * Contact en ligne : sa conversation (avec le dernier message), ou « Écrire »
 * s'il n'y en a pas encore.
 */
function OnlineRow({
  contact,
  item,
  now,
}: {
  contact: OnlineContact;
  item: InboxItem | undefined;
  now: number;
}) {
  const t = useTranslations("Messages.inbox");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (item) return <InboxRow item={{ ...item, online: true }} now={now} />;
  const name = contact.person.displayName ?? contact.person.username ?? "";
  const body = (
    <>
      <Avatar
        name={name}
        url={contact.person.avatarUrl}
        online
        className="size-12 text-lg"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="truncate font-semibold">{name}</span>
        <span className="truncate text-sm text-muted-foreground">
          {t("online")}
        </span>
      </span>
    </>
  );
  const row =
    "-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-2xl px-3 py-3 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50";
  return contact.conversationId ? (
    <Link href={`/messages/${contact.conversationId}`} className={row}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startConversationAction(contact.person.id);
          if (result.ok) router.push(`/messages/${result.id}`);
        })
      }
      className={row}
    >
      {body}
      {pending ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <span className="shrink-0 text-sm font-medium text-primary">
          {t("write")}
        </span>
      )}
    </button>
  );
}
