"use client";

import { Smile, Type, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EditableFrame,
  EmojiGrid,
  TextPanel,
  newId,
  type Draft,
  type TextOverlay,
} from "@/features/stories/components/story-studio";
import {
  STORY_OVERLAYS_MAX,
  STORY_TEXT_SIZE,
  freeSpot,
  type PostOverlay,
} from "@/features/stories/studio";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../use-media-uploads";

/**
 * Écrire n'importe où sur une photo ou la vidéo d'une publication, comme dans
 * le studio des stories (décision du fondateur, 2026-11-08) : textes (police,
 * couleur, taille, fond, alignement) et emoji qu'on déplace au doigt, qu'on
 * agrandit et tourne à deux doigts, qu'on jette dans la corbeille. Le texte
 * sous la publication reste à part.
 */
export function PostMediaEditor({
  item,
  initial,
  onSave,
  onClose,
}: {
  /** Le média (null : fermé) ; sa proportion vient de sa largeur et de sa hauteur. */
  item: MediaItem | null;
  initial: PostOverlay[];
  onSave: (overlays: PostOverlay[]) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item ? (
        // Remonté pour chaque média : il repart de ses propres textes
        <Editor
          key={item.id}
          item={item}
          initial={initial}
          onSave={onSave}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Editor({
  item,
  initial,
  onSave,
  onClose,
}: {
  item: MediaItem;
  initial: PostOverlay[];
  onSave: (overlays: PostOverlay[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Community.media.editor");
  const tStudio = useTranslations("Community.stories.studio");
  const [overlays, setOverlays] = useState<PostOverlay[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const aspect = (item.width ?? 1) / (item.height ?? 1);
  const full = overlays.length >= STORY_OVERLAYS_MAX;

  function openText(existing?: TextOverlay) {
    if (!existing && full) {
      setNotice(tStudio("limit", { max: STORY_OVERLAYS_MAX }));
      return;
    }
    setNotice(null);
    setEmoji(false);
    setDraft(
      existing ?? {
        id: newId(),
        kind: "text",
        text: "",
        font: "classic",
        color: "#ffffff",
        background: "none",
        align: "center",
        size: STORY_TEXT_SIZE.initial,
      },
    );
  }

  function saveText() {
    const current = draft;
    setDraft(null);
    if (!current) return;
    const text = current.text.trim();
    setOverlays((items) => {
      const existing = items.find((entry) => entry.id === current.id);
      if (!text) return items.filter((entry) => entry.id !== current.id);
      if (existing) {
        return items.map((entry) =>
          entry.id === current.id ? { ...existing, ...current, text } : entry,
        );
      }
      return [
        ...items,
        { ...current, text, ...freeSpot(items), scale: 1, rotation: 0 },
      ];
    });
  }

  function addEmoji(value: string) {
    if (full) {
      setNotice(tStudio("limit", { max: STORY_OVERLAYS_MAX }));
      return;
    }
    setEmoji(false);
    setOverlays((items) => [
      ...items,
      {
        id: newId(),
        kind: "emoji",
        emoji: value,
        ...freeSpot(items),
        scale: 1,
        rotation: 0,
      },
    ]);
  }

  const tool =
    "flex size-11 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <DialogContent className="dark inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none bg-black p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(56rem,calc(100dvh-2rem))] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1">
      <DialogTitle className="sr-only">{t("title")}</DialogTitle>
      <DialogDescription className="sr-only">
        {t("description")}
      </DialogDescription>

      <header className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className={tool}
        >
          <X aria-hidden="true" className="size-6" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={tStudio("text")}
            onClick={() => openText()}
            className={tool}
          >
            <Type aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            aria-label={tStudio("emoji")}
            aria-pressed={emoji}
            onClick={() => {
              setNotice(null);
              setEmoji(!emoji);
            }}
            className={cn(tool, emoji && "bg-foreground/15")}
          >
            <Smile aria-hidden="true" className="size-6" />
          </button>
        </div>
      </header>

      <div className="[container-type:size] relative flex min-h-0 flex-1 items-center justify-center">
        <EditableFrame
          item={item}
          aspect={aspect}
          overlays={overlays}
          onChange={setOverlays}
          onEditText={openText}
        />
        {overlays.length === 0 && !draft ? (
          <p className="pointer-events-none absolute inset-x-6 top-4 text-center text-sm text-pretty text-foreground/80">
            {t("hint")}
          </p>
        ) : null}
        {draft ? (
          <TextPanel draft={draft} onChange={setDraft} onDone={saveText} />
        ) : null}
        {emoji ? (
          <div
            role="dialog"
            aria-label={tStudio("emoji")}
            className="absolute inset-x-0 bottom-0 z-20 flex max-h-[60%] flex-col gap-3 overflow-y-auto rounded-3xl border border-foreground/10 bg-raised p-4"
          >
            <EmojiGrid onPick={addEmoji} />
          </div>
        ) : null}
      </div>

      {notice ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {notice}
        </p>
      ) : null}

      <footer className="flex items-center gap-2">
        {overlays.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-full text-muted-foreground"
            onClick={() => setOverlays([])}
          >
            {t("clear")}
          </Button>
        ) : null}
        <Button
          type="button"
          className="ml-auto h-11 rounded-full px-6 text-base"
          disabled={draft !== null}
          onClick={() => {
            onSave(overlays);
            onClose();
          }}
        >
          {t("done")}
        </Button>
      </footer>
    </DialogContent>
  );
}
