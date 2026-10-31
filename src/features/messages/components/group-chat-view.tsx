"use client";

import {
  ArrowLeft,
  Handshake,
  ImagePlus,
  LoaderCircle,
  Send,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/features/community/components/media-picker";
import { ReportDialog } from "@/features/community/components/report-dialog";
import type { PostMediaInput } from "@/features/community/media";
import { COMMUNITY_ERRORS } from "@/features/community/rules";
import { useMediaUploads } from "@/features/community/use-media-uploads";
import { GroupBadge } from "@/features/groups/components/group-badge";
import { Link } from "@/i18n/navigation";
import type { FeedMedia } from "@/server/community/media";
import type { ChatMessage, GroupChatState } from "@/server/messages/service";
import {
  deleteMessageAction,
  getGroupChatAction,
  loadOlderMessagesAction,
  markReadAction,
  requestMessageUploadsAction,
  sendMessageAction,
  setMessageReactionAction,
} from "../actions";
import {
  CONVERSATION_POLL_MS,
  dayOf,
  layoutMessages,
  MESSAGE_ERRORS,
  MESSAGE_MAX_LENGTH,
  type MessageError,
  type Reaction,
} from "../rules";
import { refreshUnreadCount } from "../unread-store";
import { GroupPactNote, GroupPactPanel } from "./group-pact-panel";
import { MessageBubble } from "./message-bubble";
import { ProposePactDialog } from "./propose-pact-dialog";

type LocalMessage = ChatMessage & { pending?: boolean };

/** Page la plus récente à jour, messages plus anciens déjà chargés gardés. */
function merge(current: LocalMessage[], latest: ChatMessage[]) {
  const first = latest[0];
  if (!first) return current.filter((message) => message.pending);
  const latestIds = new Set(latest.map((message) => message.id));
  const older = current.filter(
    (message) =>
      !message.pending &&
      !latestIds.has(message.id) &&
      message.createdAt < first.createdAt,
  );
  return [...older, ...latest, ...current.filter((m) => m.pending)];
}

/**
 * Discussion d'un groupe privé, en plein écran sur téléphone : le nom de
 * l'auteur au-dessus de ses messages, photos et vidéos, réactions.
 */
export function GroupChatView({
  initial,
  timeZone,
}: {
  initial: GroupChatState;
  timeZone: string;
}) {
  const t = useTranslations("Messages.conversation");
  const tGroup = useTranslations("Messages.groupChat");
  const tPacts = useTranslations("Messages.pacts");
  const [proposing, setProposing] = useState(false);
  const tErrors = useTranslations("Messages.errors");
  const format = useFormatter();
  const fieldId = useId();
  const [chat, setChat] = useState(initial);
  const [messages, setMessages] = useState<LocalMessage[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<MessageError | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<{ type: "message"; id: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const uploads = useMediaUploads({
    request: async (files) => {
      const result = await requestMessageUploadsAction(initial.id, files);
      return result.ok
        ? result
        : {
            ok: false,
            error:
              COMMUNITY_ERRORS.find((key) => key === result.error) ??
              "unexpected",
          };
    },
  });
  const attachRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sending = useRef(0);
  const stickToBottom = useRef(true);
  const keepOffset = useRef<number | null>(null);

  // Rafraîchissement toutes les 3 secondes, quand la page est visible
  useEffect(() => {
    let active = true;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || sending.current > 0) {
        return;
      }
      const next = await getGroupChatAction(initial.id).catch(() => null);
      if (!active || !next) return;
      setChat(next);
      setMessages((current) => merge(current, next.messages));
    }, CONVERSATION_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [initial.id]);

  /** État à jour tout de suite (après une action sur un pacte). */
  async function reload() {
    const next = await getGroupChatAction(initial.id).catch(() => null);
    if (!next) return;
    setChat(next);
    setMessages((current) => merge(current, next.messages));
  }

  const lastOther = [...messages].reverse().find((m) => !m.mine)?.id;
  // Lu jusqu'ici : la pastille de la Messagerie se met à jour
  useEffect(() => {
    if (!lastOther) return;
    void markReadAction(initial.id).then(refreshUnreadCount);
  }, [lastOther, initial.id]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (keepOffset.current !== null) {
      list.scrollTop = list.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stickToBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  async function loadOlder() {
    const first = messages.find((message) => !message.pending);
    const list = listRef.current;
    if (!first || !list) return;
    setLoadingOlder(true);
    const page = await loadOlderMessagesAction(initial.id, {
      createdAt: first.createdAt,
      id: first.id,
    }).catch(() => null);
    setLoadingOlder(false);
    if (!page) return;
    keepOffset.current = list.scrollHeight - list.scrollTop;
    setMessages((current) => [...page.messages, ...current]);
    setHasMore(page.hasMore);
  }

  const attached = uploads.items.length > 0;
  const canSend = chat.canWrite;

  async function submit() {
    const body = text.trim();
    if (!body && !attached) return;
    if (attached && !uploads.ready) return;
    setError(null);
    const media: PostMediaInput = attached ? JSON.parse(uploads.payload) : [];
    const previews: FeedMedia[] = uploads.items.map((item) => ({
      kind: item.kind,
      url: item.previewUrl,
      posterUrl: null,
      width: item.width ?? 1,
      height: item.height ?? 1,
      durationMs: item.durationMs ?? null,
    }));
    const temp: LocalMessage = {
      id: `temp-${Date.now()}`,
      senderId: "",
      mine: true,
      kind: "text",
      body,
      progress: null,
      pact: null,
      post: null,
      story: null,
      media: previews,
      deleted: false,
      createdAt: new Date().toISOString(),
      reactions: [],
      pending: true,
    };
    stickToBottom.current = true;
    setMessages((current) => [...current, temp]);
    setText("");
    sending.current += 1;
    const result = await sendMessageAction(initial.id, {
      kind: "text",
      body,
      media,
    }).catch(() => ({ ok: false as const, error: "unexpected" as const }));
    sending.current -= 1;
    setMessages((current) => {
      const rest = current.filter((message) => message.id !== temp.id);
      return result.ok && !rest.some((m) => m.id === result.message.id)
        ? [...rest, result.message]
        : rest;
    });
    if (!result.ok) {
      setError(result.error);
      setText(body);
      return;
    }
    if (attached) uploads.reset();
  }

  async function react(message: LocalMessage, kind: Reaction | null) {
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? {
              ...item,
              reactions: [
                ...item.reactions.filter((reaction) => !reaction.mine),
                ...(kind ? [{ kind, mine: true }] : []),
              ],
            }
          : item,
      ),
    );
    setSelected(null);
    await setMessageReactionAction(message.id, kind);
  }

  async function remove(message: LocalMessage) {
    setSelected(null);
    if (await deleteMessageAction(message.id)) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, deleted: true, body: "", media: [], reactions: [] }
            : item,
        ),
      );
    }
  }

  const today = dayOf(new Date(chat.loadedAt).toISOString(), timeZone);
  const yesterday = dayOf(
    new Date(chat.loadedAt - 24 * 60 * 60 * 1000).toISOString(),
    timeZone,
  );
  function dayLabel(day: string, iso: string) {
    if (day === today) return t("today");
    if (day === yesterday) return t("yesterday");
    return format.dateTime(new Date(iso), {
      day: "numeric",
      month: "long",
      timeZone,
    });
  }

  const laidOut = layoutMessages(messages, timeZone);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background lg:static lg:z-auto lg:h-[calc(100dvh-7rem)] lg:overflow-hidden lg:rounded-3xl lg:glass">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-foreground/5 px-2 sm:px-4">
        <Button asChild variant="ghost" size="icon-lg">
          <Link href="/messages" aria-label={t("back")}>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <GroupBadge topic={chat.group.topic} className="size-10" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-heading font-bold">{chat.group.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {tGroup("members", { count: chat.group.memberCount })}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/groups/${chat.group.id}`}>{tGroup("viewGroup")}</Link>
        </Button>
      </header>
      {chat.pact ? (
        <GroupPactPanel
          pact={chat.pact}
          canWrite={chat.canWrite}
          onChanged={() => void reload()}
        />
      ) : null}

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current =
            list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
      >
        {hasMore ? (
          <div className="mb-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingOlder}
              onClick={loadOlder}
            >
              {loadingOlder ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("older")}
            </Button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-10 text-center">
            <GroupBadge topic={chat.group.topic} className="size-16" />
            <p className="text-xs text-muted-foreground">{tGroup("privacy")}</p>
          </div>
        ) : null}

        <p
          role="status"
          className={
            notice ? "mb-3 text-center text-sm text-primary" : "sr-only"
          }
        >
          {notice}
        </p>

        <ol aria-live="polite" className="flex flex-col">
          {laidOut.map((message, index) => {
            const previous = laidOut[index - 1];
            const person = chat.people[message.senderId];
            // Le nom de l'auteur au début d'une suite de ses messages
            const showName =
              !message.mine &&
              (message.day || previous?.senderId !== message.senderId);
            return (
              <li key={message.id}>
                {message.day ? (
                  <p className="my-3 text-center text-xs font-medium text-muted-foreground">
                    {dayLabel(message.day, message.createdAt)}
                  </p>
                ) : null}
                {message.kind === "pact" ? (
                  <GroupPactNote
                    message={message}
                    name={person?.displayName ?? person?.username ?? ""}
                  />
                ) : null}
                {message.kind !== "pact" && showName && person ? (
                  <p className="mt-2 mb-1 px-2 text-xs font-medium text-muted-foreground">
                    {person.displayName ?? person.username}
                  </p>
                ) : null}
                {message.kind === "pact" ? null : (
                  <MessageBubble
                    message={message}
                    otherName={person?.displayName ?? person?.username ?? ""}
                    groupEnd={message.groupEnd}
                    timeZone={timeZone}
                    selected={selected === message.id}
                    onSelect={() =>
                      setSelected(selected === message.id ? null : message.id)
                    }
                    onReact={(kind) => void react(message, kind)}
                    onDelete={() => void remove(message)}
                    onReport={() => {
                      setSelected(null);
                      setReport({ type: "message", id: message.id });
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="shrink-0 border-t border-foreground/5 px-3 py-3 sm:px-5">
        {canSend ? (
          <>
            {attached || uploads.error ? (
              <div className="mb-2 flex flex-col gap-1.5">
                <MediaPicker
                  items={uploads.items}
                  onAdd={uploads.add}
                  onRemove={uploads.remove}
                  controls={false}
                />
                {uploads.error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {tErrors(
                      MESSAGE_ERRORS.find((key) => key === uploads.error) ??
                        "unexpected",
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="flex items-end gap-1"
            >
              <input
                ref={attachRef}
                type="file"
                accept="image/*,video/*"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  uploads.add(event.target.files);
                  event.target.value = "";
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={tPacts("propose")}
                disabled={chat.pact !== null}
                onClick={() => setProposing(true)}
                className="shrink-0 text-primary hover:text-primary"
              >
                <Handshake aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={t("attach")}
                onClick={() => attachRef.current?.click()}
                className="shrink-0 text-primary hover:text-primary"
              >
                <ImagePlus aria-hidden="true" />
              </Button>
              <label htmlFor={fieldId} className="sr-only">
                {t("label")}
              </label>
              <textarea
                id={fieldId}
                value={text}
                rows={1}
                maxLength={MESSAGE_MAX_LENGTH}
                enterKeyHint="send"
                placeholder={t("placeholder")}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                className="field-sizing-content max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-foreground/10 bg-foreground/[0.05] px-4 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
              <Button
                type="submit"
                size="icon-lg"
                aria-label={t("send")}
                disabled={
                  (!text.trim() && !attached) || (attached && !uploads.ready)
                }
                className="shrink-0 rounded-full"
              >
                {attached && !uploads.ready ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Send aria-hidden="true" />
                )}
              </Button>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("cannotWrite")}</p>
        )}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {tErrors(error)}
          </p>
        ) : null}
      </div>

      <ProposePactDialog
        conversationId={initial.id}
        name={chat.group.name}
        open={proposing}
        onOpenChange={setProposing}
        onProposed={() => void reload()}
      />
      <ReportDialog
        target={report}
        onClose={() => setReport(null)}
        onReported={() => setNotice(t("reported"))}
      />
    </div>
  );
}
