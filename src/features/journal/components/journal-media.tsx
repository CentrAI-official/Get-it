"use client";

import { LoaderCircle, Video, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { MediaPicker } from "@/features/community/components/media-picker";
import { PostMedia } from "@/features/community/components/post-media";
import { mediaSetError } from "@/features/community/media";
import { useMediaUploads } from "@/features/community/use-media-uploads";
import type {
  JournalMediaError,
  JournalMediaItem,
} from "@/server/journal/media";
import {
  attachJournalMediaAction,
  removeJournalMediaAction,
  requestJournalUploadsAction,
} from "../actions";

type JournalMediaProps = {
  day: string;
  media: JournalMediaItem[];
  /** Page encore modifiable (7 jours) : ajouter et retirer. */
  editable: boolean;
  /** Stockage configuré : sinon, pas d'ajout. */
  photosEnabled: boolean;
};

/**
 * Photos ou vidéo d'une page du journal (4 photos ou 1 vidéo, comme une
 * publication). Les fichiers choisis sont envoyés puis joints à la page tout
 * de suite, sans attendre le texte.
 */
export function JournalMedia({
  day,
  media,
  editable,
  photosEnabled,
}: JournalMediaProps) {
  const t = useTranslations("Journal.media");
  const tErrors = useTranslations("Community.errors");
  const tEditor = useTranslations("Journal.editor.errors");
  const { items, error, add, remove, reset, ready, payload } = useMediaUploads({
    request: (files) => requestJournalUploadsAction(day, files),
  });
  const [attachError, setAttachError] = useState<JournalMediaError | null>(
    null,
  );
  const [removing, startRemoving] = useTransition();
  const attaching = useRef(false);

  // Dès que tous les fichiers choisis sont envoyés, ils rejoignent la page
  useEffect(() => {
    if (!ready || items.length === 0 || attaching.current) return;
    attaching.current = true;
    void attachJournalMediaAction(day, JSON.parse(payload))
      .then((result) => {
        setAttachError(result.ok ? null : result.error);
        reset();
      })
      .finally(() => {
        attaching.current = false;
      });
  }, [ready, items.length, payload, day, reset]);

  const full =
    mediaSetError([...media, { kind: "image" as const }]) !== null ||
    items.length > 0;

  if (!editable) {
    return media.length > 0 ? <PostMedia media={media} /> : null;
  }

  return (
    <section aria-label={t("label")} className="flex flex-col gap-3">
      {media.length > 0 ? <PostMedia media={media} /> : null}

      {media.length > 0 ? (
        <ul aria-label={t("manage")} className="flex flex-wrap gap-2">
          {media.map((item, index) => (
            <li
              key={item.id}
              className="relative size-14 overflow-hidden rounded-xl bg-white/5"
            >
              {item.kind === "image" || item.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    item.kind === "image" ? item.url : (item.posterUrl ?? "")
                  }
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
              {item.kind === "video" ? (
                <Video
                  aria-hidden="true"
                  className="absolute bottom-1 left-1 size-3.5 drop-shadow"
                />
              ) : null}
              <button
                type="button"
                disabled={removing}
                aria-label={t("remove", { index: index + 1 })}
                onClick={() =>
                  startRemoving(async () => {
                    await removeJournalMediaAction(item.id);
                  })
                }
                className="absolute inset-0 flex items-start justify-end p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-black/70 text-white">
                  {removing ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-3.5 animate-spin"
                    />
                  ) : (
                    <X aria-hidden="true" className="size-3.5" />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {photosEnabled && (!full || items.length > 0) ? (
        <MediaPicker
          items={items}
          onAdd={add}
          onRemove={remove}
          disabled={items.length > 0}
        />
      ) : null}
      {photosEnabled && full && items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("full")}</p>
      ) : null}

      {error || attachError ? (
        <p role="alert" className="text-sm text-destructive">
          {attachError === "locked"
            ? tEditor("locked")
            : tErrors(error ?? attachError ?? "unexpected")}
        </p>
      ) : null}
    </section>
  );
}
