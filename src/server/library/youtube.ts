import "server-only";
import { z } from "zod";
import { YOUTUBE_CHANNEL_MAX } from "@/features/library/rules";

// Vérifie une démonstration YouTube avant de l'enregistrer, avec l'oEmbed
// public de YouTube (sans clé) : la vidéo existe, est publique et son créateur
// permet l'intégration. On garde le nom de la chaîne pour le crédit.

const oembedSchema = z.object({ author_name: z.string(), title: z.string() });

/** Chaîne et titre d'une vidéo intégrable ; null sinon (privée, supprimée, intégration refusée). */
export async function checkYoutubeVideo(
  id: string,
): Promise<{ channel: string; title: string } | null> {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    if (!response.ok) return null;
    const data = oembedSchema.safeParse(await response.json());
    if (!data.success) return null;
    return {
      channel: data.data.author_name.trim().slice(0, YOUTUBE_CHANNEL_MAX),
      title: data.data.title,
    };
  } catch {
    return null;
  }
}
