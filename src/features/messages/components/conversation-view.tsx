"use client";

import {
  ArrowLeft,
  Ban,
  EllipsisVertical,
  Flag,
  LoaderCircle,
  Send,
  ShieldAlert,
  Trash2,
  Trophy,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
import { blockUserAction } from "@/features/community/actions";
import { ReportDialog } from "@/features/community/components/report-dialog";
import type { ProgressData } from "@/features/community/rules";
import { Link, useRouter } from "@/i18n/navigation";
import type { ProgressSource } from "@/server/community/posts";
import type { ChatMessage, ConversationState } from "@/server/messages/service";
import {
  clearConversationAction,
  deleteMessageAction,
  getConversationAction,
  loadOlderMessagesAction,
  markReadAction,
  respondToRequestAction,
  sendMessageAction,
  setMessageReactionAction,
} from "../actions";
import {
  CONVERSATION_POLL_MS,
  dayOf,
  layoutMessages,
  MESSAGE_MAX_LENGTH,
  type MessageError,
  type Reaction,
} from "../rules";
import { refreshUnreadCount } from "../unread-store";
import { MessageBubble } from "./message-bubble";
import { ProgressPicker } from "./progress-picker";

type LocalMessage = ChatMessage & { pending?: boolean };

type ConversationViewProps = {
  initial: ConversationState;
  /** Fuseau de l'utilisateur : heures et jours des messages. */
  timeZone: string;
};

/** L'état de la conversation, sans ses messages (gérés à part). */
function meta(state: ConversationState) {
  return {
    id: state.id,
    other: state.other,
    viewerStatus: state.viewerStatus,
    otherStatus: state.otherStatus,
    permission: state.permission,
    canWrite: state.canWrite,
  };
}

/**
 * Remplace la page la plus récente par sa version à jour (nouveaux messages,
 * réactions, suppressions) et garde les messages plus anciens déjà chargés.
 */
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
  const pending = current.filter((message) => message.pending);
  return [...older, ...latest, ...pending];
}

/** Une conversation privée, en plein écran sur téléphone. */
export function ConversationView({ initial, timeZone }: ConversationViewProps) {
  const t = useTranslations("Messages.conversation");
  const tErrors = useTranslations("Messages.errors");
  const tInbox = useTranslations("Messages.inbox");
  const format = useFormatter();
  const router = useRouter();
  const fieldId = useId();
  const [state, setState] = useState(() => meta(initial));
  const [loadedAt, setLoadedAt] = useState(initial.loadedAt);
  const [messages, setMessages] = useState<LocalMessage[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<MessageError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState<"block" | "clear" | null>(null);
  const [report, setReport] = useState<{
    type: "message" | "user";
    id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sending = useRef(0);
  // Défilement : en bas à l'ouverture et à chaque nouveau message (si on y est déjà)
  const stickToBottom = useRef(true);
  const keepOffset = useRef<number | null>(null);

  const other = state.other;
  const name = other.displayName ?? other.username ?? "";
  const handle = `@${other.username ?? ""}`;
  const lastOther = [...messages].reverse().find((m) => !m.mine)?.id;

  // Rafraîchissement toutes les 3 secondes, quand la page est visible
  useEffect(() => {
    let active = true;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || sending.current > 0) {
        return;
      }
      const next = await getConversationAction(initial.id).catch(() => null);
      if (!active) return;
      if (!next) {
        setGone(true);
        return;
      }
      setState(meta(next));
      setLoadedAt(next.loadedAt);
      setMessages((current) => merge(current, next.messages));
    }, CONVERSATION_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [initial.id]);

  // Lu jusqu'ici : la pastille de la Messagerie se met à jour
  useEffect(() => {
    if (!lastOther || state.viewerStatus === "request") return;
    void markReadAction(initial.id).then(refreshUnreadCount);
  }, [lastOther, initial.id, state.viewerStatus]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (keepOffset.current !== null) {
      // Messages précédents ajoutés en haut : la lecture ne saute pas
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

  async function send(
    input:
      | { kind: "text"; body: string }
      | {
          kind: "progress";
          source: ProgressSource;
          progress: ProgressData;
          body: string;
        },
  ) {
    setError(null);
    const temp: LocalMessage = {
      id: `temp-${Date.now()}`,
      senderId: "",
      mine: true,
      kind: input.kind,
      body: input.body,
      progress: input.kind === "progress" ? input.progress : null,
      deleted: false,
      createdAt: new Date().toISOString(),
      reactions: [],
      pending: true,
    };
    stickToBottom.current = true;
    setMessages((current) => [...current, temp]);
    if (input.kind === "text") setText("");
    sending.current += 1;
    const result = await sendMessageAction(
      initial.id,
      input.kind === "text"
        ? input
        : { kind: "progress", source: input.source, body: input.body },
    ).catch(() => ({ ok: false as const, error: "unexpected" as const }));
    sending.current -= 1;
    setMessages((current) => {
      const rest = current.filter((message) => message.id !== temp.id);
      return result.ok && !rest.some((m) => m.id === result.message.id)
        ? [...rest, result.message]
        : rest;
    });
    if (!result.ok) {
      setError(result.error);
      if (input.kind === "text") setText(input.body);
      return;
    }
    // Première demande envoyée : l'état (en attente) se met à jour
    if (state.otherStatus === "request") {
      const next = await getConversationAction(initial.id).catch(() => null);
      if (next) setState(meta(next));
    }
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    void send({ kind: "text", body });
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
            ? {
                ...item,
                deleted: true,
                body: "",
                progress: null,
                reactions: [],
              }
            : item,
        ),
      );
    }
  }

  async function respond(accept: boolean) {
    setBusy(true);
    const done = await respondToRequestAction(initial.id, accept);
    setBusy(false);
    if (!done) return;
    refreshUnreadCount();
    if (accept) {
      setState((current) => ({
        ...current,
        viewerStatus: "accepted",
        permission: "ok",
      }));
    } else {
      router.replace("/messages");
    }
  }

  async function confirmAction() {
    setBusy(true);
    const done =
      confirm === "block"
        ? await blockUserAction(other.id)
        : await clearConversationAction(initial.id);
    setBusy(false);
    setConfirm(null);
    if (done) {
      refreshUnreadCount();
      router.replace("/messages");
    }
  }

  const today = dayOf(new Date(loadedAt).toISOString(), timeZone);
  const yesterday = dayOf(
    new Date(loadedAt - 24 * 60 * 60 * 1000).toISOString(),
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

  const canSend =
    !gone &&
    state.canWrite &&
    state.permission === "ok" &&
    state.viewerStatus === "accepted";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background lg:static lg:z-auto lg:h-[calc(100dvh-7rem)] lg:overflow-hidden lg:rounded-3xl lg:glass">
      {/* En-tête : retour, personne (niveau plutôt qu'« en ligne »), menu */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/5 px-2 sm:px-4">
        <Button asChild variant="ghost" size="icon-lg">
          <Link href="/messages" aria-label={t("back")}>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full orb font-heading font-bold uppercase"
        >
          {name.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-heading font-bold">{name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {handle} · {tInbox("level", { level: other.level })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-lg" aria-label={t("menu")}>
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              onSelect={() => setReport({ type: "user", id: other.id })}
            >
              <Flag aria-hidden="true" />
              {t("report", { handle })}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirm("block")}
            >
              <Ban aria-hidden="true" />
              {t("block", { handle })}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirm("clear")}>
              <Trash2 aria-hidden="true" />
              {t("clear")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

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
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-full orb font-heading text-2xl font-bold uppercase"
            >
              {name.charAt(0)}
            </span>
            {state.otherStatus === "request" ? (
              <p className="text-sm">{t("firstMessage", { name })}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">{t("privacy")}</p>
          </div>
        ) : null}

        <ol aria-live="polite" className="flex flex-col">
          {layoutMessages(messages, timeZone).map((message) => (
            <li key={message.id}>
              {message.day ? (
                <p className="my-3 text-center text-xs font-medium text-muted-foreground">
                  {dayLabel(message.day, message.createdAt)}
                </p>
              ) : null}
              <MessageBubble
                message={message}
                otherName={name}
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
            </li>
          ))}
        </ol>
      </div>

      {/* Bas : demande reçue, demande en attente, ou champ d'envoi */}
      <div className="shrink-0 border-t border-white/5 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5">
        {notice ? (
          <p role="status" className="mb-2 text-sm text-primary">
            {notice}
          </p>
        ) : null}
        {gone ? (
          <p className="text-sm text-muted-foreground">{t("gone")}</p>
        ) : state.viewerStatus === "request" ? (
          <div className="flex flex-col gap-3 rounded-2xl glass p-4">
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{t("requestTitle", { name })}</p>
              <p className="text-sm text-muted-foreground">
                {t("requestDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void respond(true)}>
                {t("accept")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void respond(false)}
              >
                {t("decline")}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirm("block")}
                className="text-destructive hover:text-destructive"
              >
                {t("block", { handle })}
              </Button>
            </div>
          </div>
        ) : !state.canWrite ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            {t("cannotWrite")}
          </p>
        ) : state.permission === "requestPending" ? (
          <p className="text-sm text-muted-foreground">
            {t("pending", { handle })}
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex items-end gap-2"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={t("sendProgress")}
              disabled={!canSend}
              onClick={() => setPicker(true)}
              className="shrink-0 text-primary hover:text-primary"
            >
              <Trophy aria-hidden="true" />
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
                  submit();
                }
              }}
              className="field-sizing-content max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label={t("send")}
              disabled={!canSend || !text.trim()}
              className="shrink-0 rounded-full"
            >
              <Send aria-hidden="true" />
            </Button>
          </form>
        )}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {tErrors(error)}
          </p>
        ) : null}
      </div>

      <ProgressPicker
        open={picker}
        onOpenChange={setPicker}
        onSend={(choice) => void send({ kind: "progress", ...choice })}
      />
      <ReportDialog
        target={report}
        onClose={() => setReport(null)}
        onReported={() => setNotice(t("reported"))}
      />
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(value) => !value && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "block"
                ? t("blockTitle", { handle })
                : t("clearTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "block"
                ? t("blockDescription")
                : t("clearDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmAction()}
            >
              {busy ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {confirm === "block" ? t("blockConfirm") : t("clearConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
