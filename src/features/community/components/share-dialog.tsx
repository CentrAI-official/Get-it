"use client";

import {
  Check,
  Link2,
  LoaderCircle,
  Repeat2,
  Search,
  Send,
  Share,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listShareTargetsAction,
  sendPostAction,
} from "@/features/messages/actions";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/server/community/feed";
import type { ShareTarget } from "@/server/messages/service";
import { sharePostAction } from "../actions";
import { POST_MAX_LENGTH } from "../rules";

type ShareDialogProps = {
  post: FeedPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Peut écrire dans le Centre (partager dans son fil, envoyer). */
  canWrite: boolean;
  onNotice: (text: string) => void;
};

/** Adresse de la publication : réservée aux membres (connexion demandée). */
function postUrl(locale: string, postId: string) {
  return `${window.location.origin}/${locale}/community/posts/${postId}`;
}

/** Copie un texte, aussi en http sur le Wi-Fi (sans l'API Presse-papiers). */
async function copyText(text: string, container: HTMLElement | null) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Refusé : la méthode de secours essaie encore
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  // Dans la fenêtre : elle garde le focus pendant la copie
  (container ?? document.body).append(area);
  area.select();
  const done = document.execCommand("copy");
  area.remove();
  return done;
}

const option =
  "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-medium outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const optionIcon =
  "flex size-12 items-center justify-center rounded-full bg-foreground/[0.08]";

/**
 * « Partager » : dans mon fil (avec un mot), à une discussion ou un contact,
 * copier le lien (membres seulement) ou une autre application du téléphone.
 */
export function ShareDialog({
  post,
  open,
  onOpenChange,
  canWrite,
  onNotice,
}: ShareDialogProps) {
  const t = useTranslations("Community.share");
  const tErrors = useTranslations("Community.errors");
  const tMessages = useTranslations("Messages.errors");
  const locale = useLocale();
  const id = useId();
  const [step, setStep] = useState<"menu" | "feed">("menu");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [targets, setTargets] = useState<ShareTarget[] | null>(null);
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  // Discussions et contacts chargés à l'ouverture
  useEffect(() => {
    if (!open || !canWrite) return;
    let active = true;
    void listShareTargetsAction().then((list) => {
      if (active) setTargets(list);
    });
    return () => {
      active = false;
    };
  }, [open, canWrite]);

  function change(value: boolean) {
    if (!value) {
      setStep("menu");
      setNote("");
      setError(null);
      setCopied(false);
      setQuery("");
      setSent(new Set());
    }
    onOpenChange(value);
  }

  const canRepost = canWrite && !post.mine && !post.hidden;
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    setError(null);
    const done = await copyText(postUrl(locale, post.id), container);
    if (done) setCopied(true);
    else setError(tErrors("unexpected"));
  }

  async function nativeShare() {
    try {
      await navigator.share({ url: postUrl(locale, post.id) });
    } catch {
      // Partage annulé : rien à faire
    }
  }

  function repost() {
    setError(null);
    startTransition(async () => {
      const result = await sharePostAction({ postId: post.id, body: note });
      if (result.ok) {
        change(false);
        onNotice(t("sharedNotice"));
      } else {
        setError(tErrors(result.error));
      }
    });
  }

  async function send(target: ShareTarget) {
    setError(null);
    setSending(target.person.id);
    const result = await sendPostAction({
      postId: post.id,
      to: target.conversationId
        ? { conversationId: target.conversationId }
        : { userId: target.person.id },
      body: note,
    }).catch(() => ({ ok: false as const, error: "unexpected" as const }));
    setSending(null);
    if (result.ok) {
      setSent((current) => new Set(current).add(target.person.id));
    } else {
      setError(tMessages(result.error));
    }
  }

  const needle = query.trim().toLowerCase();
  const shown = (targets ?? []).filter(
    ({ person }) =>
      !needle ||
      (person.displayName ?? "").toLowerCase().includes(needle) ||
      (person.username ?? "").toLowerCase().includes(needle),
  );

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        ref={setContainer}
        closeLabel={t("close")}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto"
      >
        <DialogTitle>
          {step === "feed" ? t("feedTitle") : t("title")}
        </DialogTitle>
        <DialogDescription>
          {step === "feed" ? t("feedDescription") : t("description")}
        </DialogDescription>

        {step === "feed" ? (
          <div className="flex flex-col gap-3">
            <label htmlFor={`${id}-note`} className="sr-only">
              {t("noteLabel")}
            </label>
            <Textarea
              id={`${id}-note`}
              value={note}
              maxLength={POST_MAX_LENGTH}
              rows={3}
              placeholder={t("notePlaceholder")}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} onClick={repost}>
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Repeat2 aria-hidden="true" />
                )}
                {t("feedConfirm")}
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setStep("menu")}
              >
                {t("back")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1">
              {canRepost ? (
                <button
                  type="button"
                  className={option}
                  onClick={() => {
                    setError(null);
                    setStep("feed");
                  }}
                >
                  <span className={optionIcon}>
                    <Repeat2 aria-hidden="true" className="size-5" />
                  </span>
                  {t("toFeed")}
                </button>
              ) : null}
              <button type="button" className={option} onClick={copy}>
                <span
                  className={cn(
                    optionIcon,
                    copied && "bg-primary text-primary-foreground",
                  )}
                >
                  {copied ? (
                    <Check aria-hidden="true" className="size-5" />
                  ) : (
                    <Link2 aria-hidden="true" className="size-5" />
                  )}
                </span>
                {copied ? t("copied") : t("copyLink")}
              </button>
              {canNativeShare ? (
                <button type="button" className={option} onClick={nativeShare}>
                  <span className={optionIcon}>
                    <Share aria-hidden="true" className="size-5" />
                  </span>
                  {t("otherApps")}
                </button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{t("membersOnly")}</p>

            {canWrite ? (
              <section
                aria-labelledby={`${id}-send`}
                className="flex flex-col gap-3 border-t border-foreground/8 pt-4"
              >
                <h3 id={`${id}-send`} className="font-heading font-semibold">
                  {t("sendTitle")}
                </h3>
                <label htmlFor={`${id}-message`} className="sr-only">
                  {t("noteLabel")}
                </label>
                <Input
                  id={`${id}-message`}
                  value={note}
                  maxLength={POST_MAX_LENGTH}
                  placeholder={t("messagePlaceholder")}
                  onChange={(event) => setNote(event.target.value)}
                />
                {targets && targets.length > 6 ? (
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <label htmlFor={`${id}-search`} className="sr-only">
                      {t("search")}
                    </label>
                    <Input
                      id={`${id}-search`}
                      value={query}
                      placeholder={t("search")}
                      onChange={(event) => setQuery(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                ) : null}
                {targets === null ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    {t("loading")}
                  </p>
                ) : shown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {targets.length === 0 ? t("noTargets") : t("noMatch")}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {shown.map((target) => {
                      const person = target.person;
                      const name = person.displayName ?? person.username ?? "";
                      const done = sent.has(person.id);
                      return (
                        <li
                          key={person.id}
                          className="flex items-center gap-3 border-b border-foreground/8 py-2.5"
                        >
                          <Avatar
                            name={name}
                            url={person.avatarUrl}
                            className="size-9"
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold">
                              {name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              @{person.username ?? ""}
                            </span>
                          </span>
                          <Button
                            size="sm"
                            variant={done ? "ghost" : "secondary"}
                            disabled={done || sending !== null}
                            onClick={() => send(target)}
                            aria-label={t("sendTo", { name })}
                          >
                            {sending === person.id ? (
                              <LoaderCircle
                                aria-hidden="true"
                                className="animate-spin"
                              />
                            ) : done ? (
                              <Check aria-hidden="true" />
                            ) : (
                              <Send aria-hidden="true" />
                            )}
                            {done ? t("sent") : t("send")}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : null}
          </>
        )}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {copied ? (
          <p role="status" className="sr-only">
            {t("copied")}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
