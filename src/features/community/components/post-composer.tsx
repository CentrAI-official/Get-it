"use client";

import { ImagePlus, LoaderCircle, Send, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PILLARS, type Pillar } from "@/config/pillars";
import { cn } from "@/lib/utils";
import type { ShareableProgress } from "@/server/community/posts";
import { createPostAction, shareProgressAction } from "../actions";
import {
  initialCommunityState,
  POST_MAX_LENGTH,
  type CommunityFormState,
} from "../rules";
import { useMediaUploads } from "../use-media-uploads";
import { MediaPicker } from "./media-picker";
import { ProgressShare } from "./progress-share";

type PostComposerProps = {
  shareable: ShareableProgress[];
  /** Progrès à présélectionner (lien « Partager » depuis un objectif ou un niveau). */
  preselected: string | null;
  /** Prénom affiché dans la barre : « Quoi de neuf, Max? » */
  name: string;
  /** Stockage configuré : photos et vidéos possibles. */
  mediaEnabled: boolean;
};

type FormProps = {
  /** Publication envoyée : la fenêtre se ferme. */
  onDone: () => void;
};

const keyOf = (item: ShareableProgress) =>
  item.source.type === "level"
    ? "level"
    : `${item.source.type}:${item.source.id}`;

const chip =
  "rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground";

/**
 * Barre discrète (« Quoi de neuf, Max? »), qui ouvre le formulaire complet :
 * texte, question ou progrès réel.
 */
export function PostComposer({
  shareable,
  preselected,
  name,
  mediaEnabled,
}: PostComposerProps) {
  const t = useTranslations("Community.composer");
  const startOnProgress = Boolean(
    preselected && shareable.some((item) => keyOf(item) === preselected),
  );
  // Lien « Partager » : la fenêtre s'ouvre directement sur le progrès
  const [open, setOpen] = useState(startOnProgress);
  const [tab, setTab] = useState<"post" | "progress">(
    startOnProgress ? "progress" : "post",
  );
  const contentRef = useRef<HTMLDivElement>(null);

  function start(next: "post" | "progress") {
    setTab(next);
    setOpen(true);
  }

  return (
    <>
      <section aria-label={t("label")} className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full orb font-heading font-bold uppercase"
        >
          {name.charAt(0)}
        </span>
        <button
          type="button"
          onClick={() => start("post")}
          className="h-10 min-w-0 flex-1 truncate rounded-full border border-white/10 bg-white/[0.04] px-4 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-white/[0.07] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("prompt", { name })}
        </button>
        {mediaEnabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={t("addMedia")}
            onClick={() => start("post")}
            className="shrink-0 text-primary hover:text-primary"
          >
            <ImagePlus aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={t("shareProgress")}
          onClick={() => start("progress")}
          className="shrink-0 text-primary hover:text-primary"
        >
          <Trophy aria-hidden="true" />
        </Button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={contentRef}
          closeLabel={t("close")}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
          onOpenAutoFocus={(event) => {
            // Le curseur va directement dans le texte
            const field = contentRef.current?.querySelector("textarea");
            if (tab !== "post" || !field) return;
            event.preventDefault();
            field.focus();
          }}
        >
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>{t("label")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </div>
          <div role="tablist" aria-label={t("label")} className="flex gap-2">
            {(["post", "progress"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(chip, tab === value ? chipOn : chipOff)}
              >
                {t(`tabs.${value}`)}
              </button>
            ))}
          </div>
          {tab === "post" ? (
            <PostForm
              mediaEnabled={mediaEnabled}
              onDone={() => setOpen(false)}
            />
          ) : (
            <ProgressForm
              shareable={shareable}
              preselected={preselected}
              onDone={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Vide le formulaire après un envoi réussi. */
function useResetOnSuccess(state: CommunityFormState, reset: () => void) {
  const last = useRef(state);
  useEffect(() => {
    if (state !== last.current && state.status === "success") reset();
    last.current = state;
  }, [state, reset]);
}

function PostForm({
  onDone,
  mediaEnabled,
}: FormProps & { mediaEnabled: boolean }) {
  const t = useTranslations("Community.composer");
  const tErrors = useTranslations("Community.errors");
  const tPillars = useTranslations("Pillars");
  const locale = useLocale();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"text" | "question">("text");
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [length, setLength] = useState(0);
  const media = useMediaUploads();
  const [state, formAction, pending] = useActionState(
    createPostAction,
    initialCommunityState,
  );
  useResetOnSuccess(state, () => {
    formRef.current?.reset();
    setPillar(null);
    setLength(0);
    media.reset();
    onDone();
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="pillar" value={pillar ?? ""} />
      <input type="hidden" name="media" value={media.payload} />
      <div
        role="radiogroup"
        aria-label={t("kindLabel")}
        className="flex flex-wrap gap-2"
      >
        {(["text", "question"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(chip, kind === value ? chipOn : chipOff)}
          >
            {t(`kinds.${value}`)}
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-body`} className="sr-only">
        {t("bodyLabel")}
      </label>
      <Textarea
        id={`${id}-body`}
        name="body"
        defaultValue={state.values?.body}
        placeholder={
          kind === "question" ? t("questionPlaceholder") : t("placeholder")
        }
        maxLength={POST_MAX_LENGTH}
        onChange={(event) => setLength(event.target.value.length)}
        className="min-h-24 rounded-2xl"
      />
      <div
        role="radiogroup"
        aria-label={t("pillarLabel")}
        className="flex flex-wrap gap-2"
      >
        {PILLARS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={pillar === value}
            onClick={() => setPillar(pillar === value ? null : value)}
            className={cn(chip, "text-xs", pillar === value ? chipOn : chipOff)}
          >
            {tPillars(`${value}.name`)}
          </button>
        ))}
      </div>
      {mediaEnabled ? (
        <MediaPicker
          items={media.items}
          onAdd={media.add}
          onRemove={media.remove}
          disabled={pending}
        />
      ) : null}
      {media.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(media.error)}
        </p>
      ) : null}
      {state.status === "error" && state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(state.error)}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          {t("length", { count: length, max: POST_MAX_LENGTH })}
        </span>
        <Button type="submit" disabled={pending || !media.ready}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {t("publish")}
        </Button>
      </div>
    </form>
  );
}

function ProgressForm({
  shareable,
  preselected,
  onDone,
}: Omit<PostComposerProps, "name" | "mediaEnabled"> & FormProps) {
  const t = useTranslations("Community.composer");
  const tErrors = useTranslations("Community.errors");
  const locale = useLocale();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<string | null>(
    preselected && shareable.some((item) => keyOf(item) === preselected)
      ? preselected
      : null,
  );
  const [state, formAction, pending] = useActionState(
    shareProgressAction,
    initialCommunityState,
  );
  useResetOnSuccess(state, () => {
    formRef.current?.reset();
    setSelected(null);
    onDone();
  });
  const chosen = shareable.find((item) => keyOf(item) === selected);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="locale" value={locale} />
      <input
        type="hidden"
        name="source"
        value={chosen ? JSON.stringify(chosen.source) : ""}
      />
      <p className="text-sm text-muted-foreground">{t("progressHelp")}</p>
      <div
        role="radiogroup"
        aria-label={t("progressLabel")}
        className="flex flex-col gap-2"
      >
        {shareable.map((item) => {
          const key = keyOf(item);
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected === key}
              onClick={() => setSelected(key)}
              className={cn(
                "rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected === key
                  ? "ring-2 ring-primary"
                  : "opacity-80 hover:opacity-100",
              )}
            >
              <ProgressShare progress={item.progress} />
            </button>
          );
        })}
      </div>
      <label htmlFor={`${id}-message`} className="sr-only">
        {t("messageLabel")}
      </label>
      <Textarea
        id={`${id}-message`}
        name="body"
        defaultValue={state.values?.body}
        placeholder={t("messagePlaceholder")}
        maxLength={POST_MAX_LENGTH}
        className="min-h-16 rounded-2xl"
      />
      {state.status === "error" && state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(state.error)}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending || !chosen}
        className="w-fit self-end"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Send aria-hidden="true" />
        )}
        {t("share")}
      </Button>
    </form>
  );
}
