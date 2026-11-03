import "server-only";
import { randomUUID } from "node:crypto";
import {
  EXTENSIONS,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_TYPES,
  type MediaMimeType,
} from "@/features/community/media";
import {
  contentIn,
  localizedContentSchema,
  matchesFilters,
  pillarOf,
  type LibraryFilters,
  type LibraryItemInput,
  type LibraryKind,
  type LibraryPillar,
  type LibraryStatus,
  type LibraryYoutube,
  type LocalizedContent,
} from "@/features/library/rules";
import { SEED_ITEMS } from "@/features/library/seed";
import { db } from "@/server/db";
import {
  createUploadUrl,
  fileInfo,
  removeFiles,
  signedUrls,
} from "@/server/storage/service";
import { checkYoutubeVideo } from "./youtube";

// Catalogue de Mon développement : lu par les membres (éléments publiés
// seulement), géré par l'équipe Get iT (rôle admin, revérifié par chaque
// fonction). Vidéos et images dans le compartiment privé, dossier library/,
// lues par des liens temporaires.

async function isAdmin(userId: string) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return profile?.role === "admin";
}

export type LibraryCard = {
  id: string;
  kind: LibraryKind;
  pillar: LibraryPillar;
  status: LibraryStatus;
  title: string;
  summary: string;
  tags: string[];
  minutes: number | null;
  imageUrl: string | null;
  hasVideo: boolean;
};

export type LibraryDetail = LibraryCard & {
  description: string;
  steps: string[];
  cues: string[];
  mistakes: string[];
  ingredients: string[];
  servings: number | null;
  videoUrl: string | null;
  /** Démonstration YouTube intégrée (une vidéo envoyée passe avant). */
  youtube: (LibraryYoutube & { channel: string | null }) | null;
};

const cardSelect = {
  id: true,
  kind: true,
  pillar: true,
  status: true,
  content: true,
  tags: true,
  minutes: true,
  imagePath: true,
  videoPath: true,
  youtubeId: true,
} as const;

type CardRow = {
  id: string;
  kind: string;
  pillar: string;
  status: string;
  content: unknown;
  tags: string[];
  minutes: number | null;
  imagePath: string | null;
  videoPath: string | null;
  youtubeId: string | null;
};

/** Contenu relu depuis la base ; null s'il ne passe plus la validation. */
const readContent = (value: unknown): LocalizedContent | null => {
  const parsed = localizedContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

function toCard(
  row: CardRow,
  content: LocalizedContent,
  locale: string,
  urls: Map<string, string>,
): LibraryCard {
  const text = contentIn(content, locale);
  return {
    id: row.id,
    kind: row.kind as LibraryKind,
    pillar: row.pillar as LibraryPillar,
    status: row.status as LibraryStatus,
    title: text.title,
    summary: text.summary,
    tags: row.tags,
    minutes: row.minutes,
    imageUrl: row.imagePath ? (urls.get(row.imagePath) ?? null) : null,
    hasVideo: row.videoPath !== null || row.youtubeId !== null,
  };
}

/**
 * Éléments d'un type (et d'un pilier pour les outils), filtrés. Les brouillons
 * ne se montrent qu'à l'équipe, pour qu'elle les relise avant de publier.
 */
export async function listLibrary(
  viewerId: string,
  input: {
    kind: LibraryKind;
    pillar: LibraryPillar;
    filters: LibraryFilters;
    locale: string;
  },
): Promise<LibraryCard[]> {
  const admin = await isAdmin(viewerId);
  const q = input.filters.q;
  const rows = await db.libraryItem.findMany({
    where: {
      kind: input.kind,
      pillar: input.pillar,
      ...(admin ? {} : { status: "published" }),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { titleEn: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "desc" }, { title: "asc" }],
    select: cardSelect,
  });
  const visible = rows.flatMap((row) => {
    const content = readContent(row.content);
    return content && matchesFilters(row.tags, input.filters)
      ? [{ row, content }]
      : [];
  });
  const urls = await signedUrls(
    visible.flatMap(({ row }) => (row.imagePath ? [row.imagePath] : [])),
  );
  return visible.map(({ row, content }) =>
    toCard(row, content, input.locale, urls),
  );
}

const youtubeOf = (row: {
  youtubeId: string | null;
  youtubeStart: number | null;
  youtubeEnd: number | null;
  youtubeChannel: string | null;
}) =>
  row.youtubeId
    ? {
        id: row.youtubeId,
        start: row.youtubeStart,
        end: row.youtubeEnd,
        channel: row.youtubeChannel,
      }
    : null;

/** Un élément du catalogue (publié, ou brouillon pour l'équipe) ; null sinon. */
export async function getLibraryItem(
  viewerId: string,
  id: string,
  locale: string,
): Promise<LibraryDetail | null> {
  const row = await db.libraryItem.findUnique({
    where: { id },
    select: {
      ...cardSelect,
      servings: true,
      youtubeStart: true,
      youtubeEnd: true,
      youtubeChannel: true,
    },
  });
  if (!row) return null;
  if (row.status !== "published" && !(await isAdmin(viewerId))) return null;
  const content = readContent(row.content);
  if (!content) return null;
  const urls = await signedUrls(
    [row.imagePath, row.videoPath].filter((path): path is string => !!path),
  );
  const text = contentIn(content, locale);
  return {
    ...toCard(row, content, locale, urls),
    description: text.description,
    steps: text.steps,
    cues: text.cues,
    mistakes: text.mistakes,
    ingredients: text.ingredients,
    servings: row.servings,
    videoUrl: row.videoPath ? (urls.get(row.videoPath) ?? null) : null,
    youtube: youtubeOf(row),
  };
}

// --- Équipe Get iT ----------------------------------------------------------

export type LibraryAdminRow = {
  id: string;
  kind: LibraryKind;
  pillar: LibraryPillar;
  status: LibraryStatus;
  title: string;
  hasVideo: boolean;
  hasImage: boolean;
  seeded: boolean;
  updatedAt: string;
};

/** Le catalogue entier pour l'équipe, brouillons compris ; null hors de l'équipe. */
export async function listLibraryAdmin(
  userId: string,
): Promise<LibraryAdminRow[] | null> {
  if (!(await isAdmin(userId))) return null;
  const rows = await db.libraryItem.findMany({
    orderBy: [{ kind: "asc" }, { status: "asc" }, { title: "asc" }],
    select: {
      id: true,
      kind: true,
      pillar: true,
      status: true,
      title: true,
      videoPath: true,
      youtubeId: true,
      imagePath: true,
      seedKey: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as LibraryKind,
    pillar: row.pillar as LibraryPillar,
    status: row.status as LibraryStatus,
    title: row.title,
    hasVideo: row.videoPath !== null || row.youtubeId !== null,
    hasImage: row.imagePath !== null,
    seeded: row.seedKey !== null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** Élément à modifier (formulaire de l'équipe) ; null hors de l'équipe. */
export async function getLibraryItemForEdit(userId: string, id: string) {
  if (!(await isAdmin(userId))) return null;
  const row = await db.libraryItem.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      pillar: true,
      status: true,
      content: true,
      tags: true,
      minutes: true,
      servings: true,
      videoPath: true,
      imagePath: true,
      youtubeId: true,
      youtubeStart: true,
      youtubeEnd: true,
      youtubeChannel: true,
    },
  });
  if (!row) return null;
  const content = readContent(row.content);
  if (!content) return null;
  const urls = await signedUrls(
    [row.imagePath, row.videoPath].filter((path): path is string => !!path),
  );
  return {
    id: row.id,
    kind: row.kind as LibraryKind,
    pillar: row.pillar as LibraryPillar,
    status: row.status as LibraryStatus,
    content,
    tags: row.tags,
    minutes: row.minutes,
    servings: row.servings,
    imageUrl: row.imagePath ? (urls.get(row.imagePath) ?? null) : null,
    videoUrl: row.videoPath ? (urls.get(row.videoPath) ?? null) : null,
    youtube: youtubeOf(row),
  };
}

export type LibraryMediaKind = "image" | "video";

/** Types acceptés pour chaque média du catalogue. */
const MEDIA_TYPES: Record<LibraryMediaKind, readonly MediaMimeType[]> = {
  image: IMAGE_TYPES,
  video: VIDEO_TYPES,
};
const MEDIA_MAX_BYTES: Record<LibraryMediaKind, number> = {
  image: MAX_IMAGE_BYTES,
  video: MAX_VIDEO_BYTES,
};

/** Autorisation d'envoi d'une image ou d'une vidéo (équipe seulement). */
export async function requestLibraryUpload(
  userId: string,
  media: LibraryMediaKind,
  contentType: MediaMimeType,
) {
  if (!(await isAdmin(userId))) return null;
  if (!MEDIA_TYPES[media].includes(contentType)) return null;
  const path = `library/${randomUUID()}.${EXTENSIONS[contentType]}`;
  return { path, url: await createUploadUrl(path) };
}

/** Le fichier envoyé convient-il (présent, du bon type, pas trop lourd) ? */
async function validMedia(media: LibraryMediaKind, path: string) {
  if (!path.startsWith("library/")) return false;
  const info = await fileInfo(path);
  return Boolean(
    info &&
    info.size > 0 &&
    info.size <= MEDIA_MAX_BYTES[media] &&
    (MEDIA_TYPES[media] as readonly string[]).includes(info.mimeType),
  );
}

export type LibrarySaveInput = LibraryItemInput & {
  status: LibraryStatus;
  /** Chemin d'un fichier envoyé, null pour retirer, undefined pour garder. */
  imagePath?: string | null;
  videoPath?: string | null;
  /** Démonstration YouTube, null pour la retirer, undefined pour garder. */
  youtube?: LibraryYoutube | null;
};

export type LibrarySaveResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: "forbidden" | "notFound" | "fileInvalid" | "youtubeUnavailable";
    };

/**
 * Colonnes de la démonstration YouTube à écrire. Une nouvelle vidéo est
 * revérifiée chez YouTube (publique, intégration permise) et sa chaîne gardée
 * pour le crédit ; la même vidéo garde sa chaîne.
 */
async function youtubeData(
  video: LibraryYoutube | null | undefined,
  current: { youtubeId: string | null; youtubeChannel: string | null } | null,
) {
  if (video === undefined) return {};
  if (video === null) {
    return {
      youtubeId: null,
      youtubeStart: null,
      youtubeEnd: null,
      youtubeChannel: null,
    };
  }
  let channel = current?.youtubeChannel ?? null;
  if (video.id !== current?.youtubeId) {
    const checked = await checkYoutubeVideo(video.id);
    if (!checked) return "unavailable" as const;
    channel = checked.channel || null;
  }
  return {
    youtubeId: video.id,
    youtubeStart: video.start,
    youtubeEnd: video.end,
    youtubeChannel: channel,
  };
}

/**
 * Crée ou modifie un élément du catalogue (équipe seulement). Les fichiers
 * envoyés sont revérifiés ; ceux remplacés ou retirés sont supprimés.
 */
export async function saveLibraryItem(
  userId: string,
  id: string | null,
  input: LibrarySaveInput,
): Promise<LibrarySaveResult> {
  if (!(await isAdmin(userId))) return { ok: false, error: "forbidden" };
  for (const media of ["image", "video"] as const) {
    const path = media === "image" ? input.imagePath : input.videoPath;
    if (path && !(await validMedia(media, path))) {
      return { ok: false, error: "fileInvalid" };
    }
  }
  const current = id
    ? await db.libraryItem.findUnique({
        where: { id },
        select: {
          kind: true,
          imagePath: true,
          videoPath: true,
          youtubeId: true,
          youtubeChannel: true,
        },
      })
    : null;
  if (id && !current) return { ok: false, error: "notFound" };
  const youtube = await youtubeData(input.youtube, current);
  if (youtube === "unavailable") {
    return { ok: false, error: "youtubeUnavailable" };
  }
  // Le type d'un élément ne change pas après sa création
  const kind = (current?.kind as LibraryKind | undefined) ?? input.kind;
  const data = {
    pillar: pillarOf(kind, input.pillar),
    status: input.status,
    title: input.content.fr.title,
    titleEn: input.content.en?.title ?? null,
    content: input.content,
    tags: input.tags,
    minutes: input.minutes,
    servings: kind === "recipe" ? input.servings : null,
    ...(input.imagePath !== undefined ? { imagePath: input.imagePath } : {}),
    ...(input.videoPath !== undefined && kind === "exercise"
      ? { videoPath: input.videoPath }
      : {}),
    ...youtube,
  };
  const saved = id
    ? await db.libraryItem.update({ where: { id }, data, select: { id: true } })
    : await db.libraryItem.create({
        data: { ...data, kind, createdById: userId },
        select: { id: true },
      });
  // Fichiers remplacés ou retirés
  const replaced = [
    input.imagePath !== undefined && current?.imagePath !== input.imagePath
      ? current?.imagePath
      : null,
    input.videoPath !== undefined && current?.videoPath !== input.videoPath
      ? current?.videoPath
      : null,
  ].filter((path): path is string => !!path);
  if (replaced.length > 0) await removeFiles(replaced).catch(() => undefined);
  return { ok: true, id: saved.id };
}

/** Publie un élément ou le remet en brouillon. */
export async function setLibraryStatus(
  userId: string,
  id: string,
  status: LibraryStatus,
) {
  if (!(await isAdmin(userId))) return false;
  const { count } = await db.libraryItem.updateMany({
    where: { id },
    data: { status },
  });
  return count > 0;
}

/** Supprime un élément et ses fichiers. */
export async function deleteLibraryItem(userId: string, id: string) {
  if (!(await isAdmin(userId))) return false;
  const row = await db.libraryItem.findUnique({
    where: { id },
    select: { imagePath: true, videoPath: true },
  });
  if (!row) return false;
  await db.libraryItem.delete({ where: { id } });
  await removeFiles(
    [row.imagePath, row.videoPath].filter((path): path is string => !!path),
  ).catch(() => undefined);
  return true;
}

/**
 * Importe le contenu de départ (rédigé avec Get iT AI, à relire) en
 * brouillons ; un élément déjà importé (même clé) n'est jamais réimporté.
 */
export async function importLibrarySeed(userId: string) {
  if (!(await isAdmin(userId))) return null;
  const { count } = await db.libraryItem.createMany({
    data: SEED_ITEMS.map((item) => ({
      kind: item.kind,
      pillar: pillarOf(item.kind, item.pillar),
      status: "draft",
      title: item.content.fr.title,
      titleEn: item.content.en?.title ?? null,
      content: item.content,
      tags: item.tags,
      minutes: item.minutes,
      servings: item.servings,
      seedKey: item.seedKey,
      createdById: userId,
    })),
    skipDuplicates: true,
  });
  return count;
}
