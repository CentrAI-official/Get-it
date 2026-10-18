"use client";

import { useEffect, useRef, useState } from "react";
import { requestUploadsAction } from "./actions";
import { kindOf, mediaSetError, type MediaKind } from "./media";
import {
  MediaError,
  prepareImage,
  prepareVideo,
  uploadFile,
} from "./media-client";
import type { CommunityError } from "./rules";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  /** Aperçu local (adresse « blob: »), libéré au retrait. */
  previewUrl: string;
  status: "processing" | "uploading" | "done" | "error";
  /** Avancement de l'envoi, de 0 à 1. */
  progress: number;
  error?: CommunityError;
  uploadId?: string;
  posterUploadId?: string;
  width?: number;
  height?: number;
  durationMs?: number;
};

/**
 * Photos ou vidéo d'une publication : préparation, autorisation d'envoi et
 * envoi de chaque fichier dès qu'il est choisi.
 */
export function useMediaUploads() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<CommunityError | null>(null);
  const previews = useRef(new Set<string>());
  const nextId = useRef(0);

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function patch(id: string, change: Partial<MediaItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }

  async function process(item: MediaItem, file: File) {
    try {
      if (item.kind === "image") {
        const image = await prepareImage(file);
        const slots = await requestUploadsAction([
          { mimeType: image.blob.type, size: image.blob.size },
        ]);
        if (!slots.ok)
          return patch(item.id, { status: "error", error: slots.error });
        const slot = slots.slots[0];
        if (!slot)
          return patch(item.id, { status: "error", error: "unexpected" });
        patch(item.id, {
          status: "uploading",
          width: image.width,
          height: image.height,
        });
        await uploadFile(slot.url, image.blob, (progress) =>
          patch(item.id, { progress }),
        );
        patch(item.id, {
          status: "done",
          progress: 1,
          uploadId: slot.uploadId,
        });
        return;
      }
      const video = await prepareVideo(file);
      const slots = await requestUploadsAction([
        { mimeType: video.mimeType, size: video.file.size },
        ...(video.poster
          ? [
              {
                mimeType: video.poster.blob.type,
                size: video.poster.blob.size,
                poster: true,
              },
            ]
          : []),
      ]);
      if (!slots.ok)
        return patch(item.id, { status: "error", error: slots.error });
      const [main, poster] = slots.slots;
      if (!main)
        return patch(item.id, { status: "error", error: "unexpected" });
      patch(item.id, {
        status: "uploading",
        width: video.width,
        height: video.height,
        durationMs: video.durationMs,
      });
      if (poster && video.poster) {
        await uploadFile(poster.url, video.poster.blob, () => undefined);
      }
      await uploadFile(main.url, video.file, (progress) =>
        patch(item.id, { progress }),
      );
      patch(item.id, {
        status: "done",
        progress: 1,
        uploadId: main.uploadId,
        posterUploadId: poster?.uploadId,
      });
    } catch (caught) {
      patch(item.id, {
        status: "error",
        error: caught instanceof MediaError ? caught.code : "unexpected",
      });
    }
  }

  /** Ajoute des fichiers choisis (galerie ou caméra). */
  function add(files: FileList | null) {
    setError(null);
    const picked = [...(files ?? [])];
    if (picked.length === 0) return;
    const kinds = picked.map(
      (file) =>
        kindOf(file.type) ??
        (file.type.startsWith("video/") ? "video" : "image"),
    );
    const next = [
      ...items
        .filter((item) => item.status !== "error")
        .map((item) => ({ kind: item.kind })),
      ...kinds.map((kind) => ({ kind })),
    ];
    if (mediaSetError(next)) {
      setError("mediaTooMany");
      return;
    }
    const added = picked.map((file, index): MediaItem => {
      const previewUrl = URL.createObjectURL(file);
      previews.current.add(previewUrl);
      return {
        // Compteur local : crypto.randomUUID n'existe pas en http (téléphone sur le Wi-Fi)
        id: `media-${(nextId.current += 1)}`,
        kind: kinds[index] ?? "image",
        previewUrl,
        status: "processing",
        progress: 0,
      };
    });
    setItems((current) => [...current, ...added]);
    added.forEach((item, index) => {
      const file = picked[index];
      if (file) void process(item, file);
    });
  }

  function remove(id: string) {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        previews.current.delete(item.previewUrl);
      }
      return current.filter((entry) => entry.id !== id);
    });
  }

  function reset() {
    for (const url of previews.current) URL.revokeObjectURL(url);
    previews.current.clear();
    setItems([]);
    setError(null);
  }

  const ready = items.every((item) => item.status === "done");
  const payload = JSON.stringify(
    items
      .filter((item) => item.status === "done" && item.uploadId)
      .map((item) => ({
        uploadId: item.uploadId,
        width: item.width,
        height: item.height,
        ...(item.durationMs ? { durationMs: item.durationMs } : {}),
        ...(item.posterUploadId ? { posterUploadId: item.posterUploadId } : {}),
      })),
  );

  return { items, error, add, remove, reset, ready, payload };
}
