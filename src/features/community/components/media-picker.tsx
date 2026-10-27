"use client";

import {
  Camera,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  Video,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../use-media-uploads";

type MediaPickerProps = {
  items: MediaItem[];
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  /** Photos seulement : pas de bouton vidéo (ex. annonces du Marketplace). */
  photosOnly?: boolean;
  /** Sans les boutons ni les limites : seulement les fichiers choisis (Messagerie). */
  controls?: boolean;
};

const pick =
  "flex h-10 cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";

/**
 * Photos ou vidéo d'une publication : galerie, appareil photo ou caméra (sur
 * téléphone, la caméra s'ouvre directement).
 */
export function MediaPicker({
  items,
  onAdd,
  onRemove,
  disabled,
  photosOnly = false,
  controls = true,
}: MediaPickerProps) {
  const t = useTranslations("Community.media");
  const tErrors = useTranslations("Community.errors");

  function choose(event: ChangeEvent<HTMLInputElement>) {
    onAdd(event.target.files);
    // Le même fichier peut être choisi de nouveau
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="relative aspect-square overflow-hidden rounded-xl bg-white/5"
            >
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <video
                  src={item.previewUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-full object-cover"
                />
              )}
              {item.status === "processing" || item.status === "uploading" ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-xs font-medium">
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-5 animate-spin"
                  />
                  {item.status === "uploading"
                    ? t("uploading", {
                        percent: Math.round(item.progress * 100),
                      })
                    : t("preparing")}
                </span>
              ) : null}
              {item.status === "error" ? (
                <span
                  role="alert"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 p-1 text-center text-[0.65rem] leading-tight text-destructive"
                >
                  <CircleAlert aria-hidden="true" className="size-4" />
                  {tErrors(item.error ?? "unexpected")}
                </span>
              ) : null}
              {item.kind === "video" ? (
                <Video
                  aria-hidden="true"
                  className="absolute bottom-1.5 left-1.5 size-4 drop-shadow"
                />
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={t("remove")}
                className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/70 text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {controls ? (
        <>
          <div
            className={cn(
              "flex flex-wrap gap-2",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <label className={pick}>
              <input
                type="file"
                accept={photosOnly ? "image/*" : "image/*,video/*"}
                multiple
                disabled={disabled}
                onChange={choose}
                className="sr-only"
              />
              <ImagePlus aria-hidden="true" className="size-4 text-primary" />
              {t(photosOnly ? "galleryPhotos" : "gallery")}
            </label>
            <label className={pick}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={disabled}
                onChange={choose}
                className="sr-only"
              />
              <Camera aria-hidden="true" className="size-4 text-primary" />
              {t("photo")}
            </label>
            {photosOnly ? null : (
              <label className={pick}>
                <input
                  type="file"
                  // Sans « capture » : iPhone et Samsung ouvraient la caméra en mode photo.
                  // Le téléphone propose alors « Prendre une vidéo » / « Caméscope ».
                  accept="video/*"
                  disabled={disabled}
                  onChange={choose}
                  className="sr-only"
                />
                <Video aria-hidden="true" className="size-4 text-primary" />
                {t("video")}
              </label>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(photosOnly ? "limitsPhotos" : "limits")}
          </p>
        </>
      ) : null}
    </div>
  );
}
