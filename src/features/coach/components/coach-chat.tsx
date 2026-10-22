"use client";

import {
  ArrowUp,
  CircleAlert,
  MessageSquarePlus,
  ShieldAlert,
  Sparkles,
  Square,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  COACH_ERRORS,
  COACH_MESSAGE_MAX_LENGTH,
  type CoachError,
  type CoachStreamEvent,
} from "../limits";
import type { CoachActionView } from "../coach-tools";
import { ActionCard } from "./action-card";
import { MessageContent } from "./message-content";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Réponse en cours, refusée, coupée, arrêtée ou interrompue par une erreur. */
  status?: "streaming" | "refused" | "truncated" | "stopped" | "failed";
  /** Ajouts proposés par Get iT AI (à accepter ou ignorer). */
  actions?: CoachActionView[];
};

type CoachChatProps = {
  conversation: { id: string; messages: ChatMessage[] } | null;
  /** Requêtes Get iT AI encore possibles aujourd'hui. */
  remaining: number;
  name: string | null;
};

const SUGGESTIONS = ["focus", "week", "progress", "restart"] as const;

const toError = (value: unknown): CoachError =>
  COACH_ERRORS.includes(value as CoachError)
    ? (value as CoachError)
    : "unexpected";

/** Conversation avec Get iT AI : la réponse s'affiche au fil de l'eau. */
export function CoachChat({
  conversation,
  remaining: initialRemaining,
  name,
}: CoachChatProps) {
  const t = useTranslations("Coach");
  const router = useRouter();
  const inputId = useId();
  const [conversationId, setConversationId] = useState(
    conversation?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    conversation?.messages ?? [],
  );
  const [remaining, setRemaining] = useState(initialRemaining);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<CoachError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Quitter la page arrête la réponse en cours
  useEffect(() => () => abortRef.current?.abort(), []);

  // Un nouveau message amène la conversation en bas
  useEffect(() => {
    if (messages.length === 0) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    endRef.current?.scrollIntoView({
      block: "end",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [messages.length]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming || remaining === 0) return;
    setError(null);
    const stamp = Date.now();
    const userId = `user-${stamp}`;
    const replyId = `reply-${stamp}`;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content },
      { id: replyId, role: "assistant", content: "", status: "streaming" },
    ]);
    setDraft("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const updateReply = (change: (message: ChatMessage) => ChatMessage) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === replyId ? change(message) : message,
        ),
      );

    const handle = (event: CoachStreamEvent) => {
      if (event.type === "start") {
        setConversationId(event.conversationId);
        setRemaining(event.remaining);
      } else if (event.type === "text") {
        updateReply((message) => ({
          ...message,
          content: message.content + event.text,
        }));
      } else if (event.type === "actions") {
        updateReply((message) => ({ ...message, actions: event.actions }));
      } else if (event.type === "done") {
        updateReply((message) => ({
          ...message,
          content: event.refused ? "" : message.content,
          status: event.refused
            ? "refused"
            : event.truncated
              ? "truncated"
              : undefined,
        }));
      } else {
        updateReply((message) => ({ ...message, status: "failed" }));
        setError(event.error);
      }
    };

    try {
      const response = await fetch("/api/v1/coach/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const data: unknown = await response.json().catch(() => null);
        const code = toError((data as { error?: unknown } | null)?.error);
        // Rien n'a été enregistré : le message revient dans le champ
        setMessages((current) =>
          current.filter(
            (message) => message.id !== userId && message.id !== replyId,
          ),
        );
        setDraft(content);
        setError(code);
        if (code === "limitReached") setRemaining(0);
        if (code === "consentRequired" || code === "notConfigured") {
          router.refresh();
        }
        return;
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handle(JSON.parse(line) as CoachStreamEvent);
        }
      }
    } catch {
      if (controller.signal.aborted) {
        updateReply((message) => ({ ...message, status: "stopped" }));
      } else {
        updateReply((message) => ({ ...message, status: "failed" }));
        setError("unexpected");
      }
    } finally {
      // Flux fermé sans fin annoncée : la réponse est incomplète
      updateReply((message) =>
        message.status === "streaming"
          ? { ...message, status: "failed" }
          : message,
      );
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée envoie ; Maj+Entrée va à la ligne
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send(draft);
    }
  }

  /** Une proposition a été ajoutée ou ignorée. */
  function updateAction(messageId: string, next: CoachActionView) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              actions: message.actions?.map((action) =>
                action.id === next.id ? next : action,
              ),
            }
          : message,
      ),
    );
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  const limitReached = remaining === 0;

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-labelledby="coach-title"
        className="flex min-h-[60dvh] flex-col"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 py-3">
          <h2
            id="coach-title"
            className="flex items-center gap-2.5 font-heading font-bold"
          >
            <span className="flex size-8 items-center justify-center rounded-full orb">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
            </span>
            {t("title")}
          </h2>
          {messages.length > 0 && !streaming ? (
            <Button variant="ghost" size="sm" onClick={newConversation}>
              <MessageSquarePlus aria-hidden="true" />
              {t("newConversation")}
            </Button>
          ) : null}
        </div>

        <div
          role="log"
          aria-label={t("logLabel")}
          aria-busy={streaming}
          className="flex flex-1 flex-col gap-5 py-5"
        >
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 glow-primary">
                <Sparkles aria-hidden="true" className="size-6 text-primary" />
              </span>
              <div className="flex max-w-md flex-col gap-1.5">
                <p className="font-heading text-xl font-bold">
                  {name ? t("welcomeTitle", { name }) : t("welcomeTitleNoName")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("welcomeBody")}
                </p>
              </div>
              <ul className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={limitReached}
                      onClick={() => void send(t(`suggestions.${key}`))}
                      className="flex h-full w-full items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm transition-colors outline-none hover:border-primary/40 hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {t(`suggestions.${key}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <div
                  key={message.id}
                  data-message="user"
                  className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-white/8 px-4 py-2.5 break-words whitespace-pre-wrap"
                >
                  <span className="sr-only">{t("you")}</span>
                  {message.content}
                </div>
              ) : (
                <div
                  key={message.id}
                  data-message="assistant"
                  className="flex max-w-[95%] gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full orb"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-2 pt-0.5">
                    <span className="sr-only">{t("title")}</span>
                    {message.content ? (
                      <MessageContent text={message.content} />
                    ) : message.status === "streaming" ? (
                      <span className="flex items-center gap-1 py-2">
                        <span className="sr-only">{t("thinking")}</span>
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            aria-hidden="true"
                            className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
                            style={{ animationDelay: `${dot * 150}ms` }}
                          />
                        ))}
                      </span>
                    ) : null}
                    {message.actions?.length ? (
                      <ul
                        aria-label={t("actions.listLabel")}
                        className="flex flex-col gap-2 pt-1"
                      >
                        {message.actions.map((action) => (
                          <ActionCard
                            key={action.id}
                            action={action}
                            onChange={(next) => updateAction(message.id, next)}
                          />
                        ))}
                      </ul>
                    ) : null}
                    {message.status === "refused" ? (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ShieldAlert
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0"
                        />
                        {t("refused")}
                      </p>
                    ) : message.status && message.status !== "streaming" ? (
                      <p className="text-xs text-muted-foreground">
                        {t(`status.${message.status}`)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ),
            )
          )}
          <div ref={endRef} />
        </div>

        {/* Zone de saisie : reste visible au-dessus de la barre flottante */}
        <form
          onSubmit={onSubmit}
          className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col gap-2 border-t border-white/8 bg-background/95 py-3 backdrop-blur-xl lg:bottom-4"
        >
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {t(`errors.${error}`)}
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <label htmlFor={inputId} className="sr-only">
              {t("inputLabel")}
            </label>
            <Textarea
              ref={inputRef}
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                limitReached ? t("limitPlaceholder") : t("placeholder")
              }
              maxLength={COACH_MESSAGE_MAX_LENGTH}
              disabled={limitReached}
              rows={1}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl"
            />
            {streaming ? (
              <Button
                type="button"
                size="icon-lg"
                variant="secondary"
                aria-label={t("stop")}
                onClick={() => abortRef.current?.abort()}
                className="size-11 rounded-2xl"
              >
                <Square aria-hidden="true" className="fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-lg"
                aria-label={t("send")}
                disabled={!draft.trim() || limitReached}
                className="size-11 rounded-2xl"
              >
                <ArrowUp aria-hidden="true" className="size-5" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={cn(limitReached && "text-foreground")}>
              {t("remaining", { count: remaining })}
            </span>
            {draft.length > COACH_MESSAGE_MAX_LENGTH - 200 ? (
              <span className="font-mono">
                {t("length", {
                  count: draft.length,
                  max: COACH_MESSAGE_MAX_LENGTH,
                })}
              </span>
            ) : (
              <span>{t("disclaimer")}</span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
