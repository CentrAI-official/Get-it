import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { UploadRequest } from "@/features/community/media";
import type { CommunityError } from "@/features/community/rules";
import type { PageError, PageInput } from "@/features/pages/rules";
import {
  requestUploads,
  verifyMedia,
  type UploadSlot,
} from "@/server/community/media";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { db } from "@/server/db";
import {
  listPageListings,
  type ListingSummary,
} from "@/server/marketplace/service";
import { avatarUrls } from "@/server/profile/avatar";
import { removeFiles } from "@/server/storage/service";

// Pages pro. Chaque fonction reçoit l'userId de la session ; seule la personne
// propriétaire modifie sa page. Le logo et la couverture sont des fichiers du
// compartiment privé « media » (dossier posts/<userId>, supprimés avec le
// compte), lus par des liens temporaires.

const pageSelect = {
  id: true,
  ownerId: true,
  handle: true,
  name: true,
  category: true,
  about: true,
  regions: true,
  website: true,
  logoPath: true,
  coverPath: true,
  createdAt: true,
} as const;

export type PageView = {
  id: string;
  handle: string;
  name: string;
  category: string;
  about: string;
  regions: string[];
  website: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
};

type PageRow = Prisma.PageGetPayload<{ select: typeof pageSelect }>;

async function toView(row: PageRow): Promise<PageView> {
  const urls = await avatarUrls([row.logoPath, row.coverPath]);
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    category: row.category,
    about: row.about,
    regions: row.regions,
    website: row.website,
    logoUrl: row.logoPath ? (urls.get(row.logoPath) ?? null) : null,
    coverUrl: row.coverPath ? (urls.get(row.coverPath) ?? null) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** La page de la personne connectée, ou null. */
export async function getMyPage(userId: string): Promise<PageView | null> {
  const row = await db.page.findUnique({
    where: { ownerId: userId },
    select: pageSelect,
  });
  return row ? toView(row) : null;
}

/** Ses annonces, tous statuts confondus (l'Espace pro). */
export async function countMyServices(pageId: string) {
  return db.listing.count({ where: { pageId } });
}

type Result = { ok: true; handle: string } | { ok: false; error: PageError };

/** Seulement les colonnes de la page. */
const pageData = (input: PageInput) => ({
  name: input.name,
  handle: input.handle,
  category: input.category,
  about: input.about,
  regions: input.regions,
  website: input.website,
});

const isTaken = (caught: unknown) =>
  caught instanceof Prisma.PrismaClientKnownRequestError &&
  caught.code === "P2002";

/**
 * Crée la page : il faut être membre du Centre (la page y est publique) et pas
 * suspendu. Les annonces déjà publiées par la personne s'y rattachent.
 */
export async function createPage(
  userId: string,
  input: PageInput,
): Promise<Result> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  const [existing, taken] = await Promise.all([
    db.page.findUnique({ where: { ownerId: userId }, select: { id: true } }),
    db.page.findUnique({
      where: { handle: input.handle },
      select: { id: true },
    }),
  ]);
  if (existing) return { ok: false, error: "alreadyHasPage" };
  if (taken) return { ok: false, error: "handleTaken" };
  try {
    await db.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: { ownerId: userId, ...pageData(input) },
        select: { id: true },
      });
      await tx.profile.update({
        where: { id: userId },
        data: { accountType: "affiliate" },
      });
      await tx.listing.updateMany({
        where: { sellerId: userId, pageId: null },
        data: { pageId: page.id },
      });
    });
  } catch (caught) {
    if (isTaken(caught)) return { ok: false, error: "handleTaken" };
    throw caught;
  }
  return { ok: true, handle: input.handle };
}

/** Modifie la page (son adresse aussi, si elle est libre). */
export async function updatePage(
  userId: string,
  input: PageInput,
): Promise<Result> {
  const taken = await db.page.findFirst({
    where: { handle: input.handle, ownerId: { not: userId } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "handleTaken" };
  try {
    const { count } = await db.page.updateMany({
      where: { ownerId: userId },
      data: pageData(input),
    });
    if (count === 0) return { ok: false, error: "notFound" };
  } catch (caught) {
    if (isTaken(caught)) return { ok: false, error: "handleTaken" };
    throw caught;
  }
  return { ok: true, handle: input.handle };
}

/**
 * Supprime la page, ses annonces et leurs photos. La personne redevient un
 * compte personnel seulement.
 */
export async function deletePage(userId: string) {
  const page = await db.page.findUnique({
    where: { ownerId: userId },
    select: {
      id: true,
      logoPath: true,
      coverPath: true,
      listings: { select: { media: { select: { path: true } } } },
      posts: {
        select: {
          media: { select: { path: true, posterPath: true } },
        },
      },
    },
  });
  if (!page) return false;
  const files = [
    page.logoPath,
    page.coverPath,
    ...page.listings.flatMap((listing) =>
      listing.media.map((media) => media.path),
    ),
    ...page.posts.flatMap((post) =>
      post.media.flatMap((media) => [media.path, media.posterPath]),
    ),
  ].filter((path): path is string => Boolean(path));
  await db.$transaction([
    db.page.deleteMany({ where: { id: page.id, ownerId: userId } }),
    db.profile.update({
      where: { id: userId },
      data: { accountType: "consumer" },
    }),
  ]);
  if (files.length > 0) await removeFiles(files).catch(() => undefined);
  return true;
}

export type PublicPage = PageView & {
  ownerId: string;
  /** La page de la personne connectée. */
  mine: boolean;
  services: ListingSummary[];
};

/**
 * Une page vue par un membre : introuvable si l'un a bloqué l'autre ou si la
 * personne propriétaire est suspendue (sauf pour elle-même).
 */
export async function getPublicPage(
  viewerId: string,
  handle: string,
): Promise<PublicPage | null> {
  const row = await db.page.findUnique({
    where: { handle },
    select: {
      ...pageSelect,
      owner: { select: { suspendedUntil: true } },
    },
  });
  if (!row) return null;
  const mine = row.ownerId === viewerId;
  if (!mine) {
    const blocked = await getBlockedIds(viewerId);
    if (blocked.includes(row.ownerId)) return null;
    if (row.owner.suspendedUntil && row.owner.suspendedUntil > new Date()) {
      return null;
    }
  }
  const [view, services] = await Promise.all([
    toView(row),
    listPageListings(viewerId, row.id),
  ]);
  return { ...view, ownerId: row.ownerId, mine, services };
}

export const PAGE_IMAGES = ["logo", "cover"] as const;
export type PageImage = (typeof PAGE_IMAGES)[number];

type ImageResult = { ok: true } | { ok: false; error: CommunityError };

/** Autorisation d'envoi du logo ou de la couverture (une seule image). */
export async function requestPageImageUpload(
  userId: string,
  files: UploadRequest,
): Promise<
  { ok: true; slots: UploadSlot[] } | { ok: false; error: CommunityError }
> {
  const page = await db.page.count({ where: { ownerId: userId } });
  if (page === 0) return { ok: false, error: "notFound" };
  if (
    files.length !== 1 ||
    files.some((file) => file.poster || !file.mimeType.startsWith("image/"))
  ) {
    return { ok: false, error: "mediaType" };
  }
  return requestUploads(userId, files);
}

/** Remplace le logo ou la couverture par un envoi vérifié ; l'ancienne image est supprimée. */
export async function setPageImage(
  userId: string,
  which: PageImage,
  upload: { uploadId: string; width: number; height: number },
): Promise<ImageResult> {
  const verified = await verifyMedia(userId, [upload]);
  if (!verified.ok) return verified;
  const row = verified.media.rows[0];
  if (!row || row.kind !== "image") return { ok: false, error: "mediaType" };
  const column = which === "logo" ? "logoPath" : "coverPath";

  const previous = await db.$transaction(async (tx) => {
    const page = await tx.page.findUnique({
      where: { ownerId: userId },
      select: { logoPath: true, coverPath: true },
    });
    if (!page) throw new Error("Page introuvable");
    await tx.page.update({
      where: { ownerId: userId },
      data: { [column]: row.path },
    });
    const { count } = await tx.mediaUpload.updateMany({
      where: { id: { in: verified.media.uploadIds }, userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    // Un même envoi ne sert qu'une fois
    if (count !== verified.media.uploadIds.length) {
      throw new Error("Média déjà utilisé");
    }
    return page[column];
  });
  if (previous) await removeFiles([previous]).catch(() => undefined);
  return { ok: true };
}

/** Retire le logo ou la couverture (le fichier est supprimé). */
export async function removePageImage(userId: string, which: PageImage) {
  const column = which === "logo" ? "logoPath" : "coverPath";
  const page = await db.page.findUnique({
    where: { ownerId: userId },
    select: { logoPath: true, coverPath: true },
  });
  const path = page?.[column];
  if (!path) return false;
  await db.page.update({
    where: { ownerId: userId },
    data: { [column]: null },
  });
  await removeFiles([path]).catch(() => undefined);
  return true;
}
