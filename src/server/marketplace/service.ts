import "server-only";
import type { Pillar } from "@/config/pillars";
import type { UploadRequest } from "@/features/community/media";
import {
  CATALOG_PAGE_SIZE,
  DAILY_LISTINGS,
  FAVORITES_MAX,
  IN_PERSON_REGIONS,
  MARKETPLACE_ERRORS,
  MAX_ACTIVE_LISTINGS,
  PRICE_RANGES,
  type AccountType,
  type CatalogFilters,
  type ListingInput,
  type ListingKind,
  type MarketplaceError,
} from "@/features/marketplace/rules";
import type { Prisma } from "@/generated/prisma/client";
import {
  requestUploads,
  verifyMedia,
  type UploadSlot,
} from "@/server/community/media";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { db } from "@/server/db";
import { avatarUrls } from "@/server/profile/avatar";
import { removeFiles, signedUrls } from "@/server/storage/service";

// Marketplace : chaque fonction reçoit l'userId de la session. Une annonce
// n'est visible des acheteurs qu'une fois approuvée par l'équipe Get iT, si son
// vendeur est toujours affilié, n'est pas suspendu et n'est pas bloqué.

type Fail = { ok: false; error: MarketplaceError };

/** Erreurs des photos (partagées avec les publications) vers celles du Marketplace. */
function asMarketplaceError(error: string): MarketplaceError {
  return MARKETPLACE_ERRORS.find((item) => item === error) ?? "unexpected";
}

export type ListingPhoto = { url: string; width: number; height: number };

export type ListingSummary = {
  id: string;
  kind: ListingKind;
  pillar: Pillar;
  category: string;
  title: string;
  summary: string;
  priceMinCents: number;
  priceMaxCents: number | null;
  priceUnit: string;
  regions: string[];
  photo: ListingPhoto | null;
  /** Gardée dans « Mes favoris » par la personne connectée. */
  favorite: boolean;
  seller: {
    displayName: string | null;
    username: string | null;
    /** Photo de profil (lien temporaire), ou null. */
    avatarUrl: string | null;
  };
};

export type ListingDetail = ListingSummary & {
  status: "pending" | "approved" | "rejected" | "archived";
  description: string;
  website: string | null;
  socialUrl: string | null;
  photos: ListingPhoto[];
  sellerId: string;
  createdAt: string;
  /** La personne connectée est le vendeur. */
  mine: boolean;
  reviewNote: string | null;
};

/** Coordonnées privées, réservées à l'équipe Get iT (approbation). */
export type ListingForReview = ListingDetail & {
  contactName: string;
  contactEmail: string;
  licenseNumber: string | null;
};

/** Seule l'équipe Get iT (rôle admin) approuve les annonces. */
async function isAdmin(userId: string) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return profile?.role === "admin";
}

/** Peut vendre : affilié, membre du Centre (nom public) et pas suspendu. */
async function canSell(userId: string): Promise<{ ok: true } | Fail> {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { accountType: true },
  });
  if (profile?.accountType !== "affiliate") {
    return { ok: false, error: "notAffiliate" };
  }
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  return { ok: true };
}

/** Conditions d'une annonce visible des acheteurs. */
function visibleWhere(blocked: string[]): Prisma.ListingWhereInput {
  return {
    status: "approved",
    sellerId: blocked.length > 0 ? { notIn: blocked } : undefined,
    seller: {
      accountType: "affiliate",
      OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: new Date() } }],
    },
  };
}

const summarySelect = {
  id: true,
  kind: true,
  pillar: true,
  category: true,
  title: true,
  summary: true,
  priceMinCents: true,
  priceMaxCents: true,
  priceUnit: true,
  regions: true,
  seller: { select: { displayName: true, username: true, avatarPath: true } },
} satisfies Prisma.ListingSelect;

type SellerRow = {
  displayName: string | null;
  username: string | null;
  avatarPath: string | null;
};

/** Vendeurs avec le lien de leur photo (le chemin du fichier ne sort pas du serveur). */
async function sellerAvatars(rows: { seller: SellerRow }[]) {
  const avatars = await avatarUrls(rows.map((row) => row.seller.avatarPath));
  return (seller: SellerRow) => ({
    displayName: seller.displayName,
    username: seller.username,
    avatarUrl: seller.avatarPath
      ? (avatars.get(seller.avatarPath) ?? null)
      : null,
  });
}

/** Photos de plusieurs annonces, avec leurs liens de lecture temporaires. */
async function photosFor(listingIds: string[], firstOnly: boolean) {
  const byListing = new Map<string, ListingPhoto[]>();
  if (listingIds.length === 0) return byListing;
  const rows = await db.listingMedia.findMany({
    where: {
      listingId: { in: listingIds },
      position: firstOnly ? 0 : undefined,
    },
    orderBy: { position: "asc" },
    select: { listingId: true, path: true, width: true, height: true },
  });
  if (rows.length === 0) return byListing;
  const urls = await signedUrls(rows.map((row) => row.path)).catch(
    () => new Map<string, string>(),
  );
  for (const row of rows) {
    const url = urls.get(row.path);
    if (!url) continue;
    const list = byListing.get(row.listingId) ?? [];
    list.push({ url, width: row.width, height: row.height });
    byListing.set(row.listingId, list);
  }
  return byListing;
}

/** Catalogue d'un onglet (services ou gear), filtré, 20 annonces à la fois. */
export async function listCatalog(
  viewerId: string,
  kind: ListingKind,
  filters: CatalogFilters,
  cursor?: string,
) {
  const blocked = await getBlockedIds(viewerId);
  const range = PRICE_RANGES.find((item) => item.key === filters.price);
  const service = kind === "service";
  const and: Prisma.ListingWhereInput[] = [];
  if (service && filters.region) and.push({ regions: { has: filters.region } });
  if (filters.category) and.push({ category: filters.category });
  // « Que veux-tu accomplir? » : dans le titre ou le résumé, sans tenir compte de la casse
  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { summary: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  // En ligne : la région « online » ; en présentiel : au moins une vraie région
  if (service && filters.mode === "online") {
    and.push({ regions: { has: "online" } });
  }
  if (service && filters.mode === "in_person") {
    and.push({ regions: { hasSome: IN_PERSON_REGIONS } });
  }
  // La fourchette d'une annonce touche la tranche choisie
  if (range) {
    if (range.max !== null) and.push({ priceMinCents: { lt: range.max } });
    and.push({
      OR: [
        { priceMaxCents: { gte: range.min } },
        { priceMaxCents: null, priceMinCents: { gte: range.min } },
      ],
    });
  }
  const where: Prisma.ListingWhereInput = {
    ...visibleWhere(blocked),
    kind,
    pillar: filters.pillar,
    AND: and,
  };
  const rows = await db.listing.findMany({
    where,
    orderBy: { id: "desc" },
    take: CATALOG_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: summarySelect,
  });
  const page = rows.slice(0, CATALOG_PAGE_SIZE);
  const ids = page.map((row) => row.id);
  const [photos, seller, favorites] = await Promise.all([
    photosFor(ids, true),
    sellerAvatars(page),
    favoriteIdsAmong(viewerId, ids),
  ]);
  return {
    items: page.map((row): ListingSummary => ({
      ...row,
      seller: seller(row.seller),
      photo: photos.get(row.id)?.[0] ?? null,
      favorite: favorites.has(row.id),
    })),
    nextCursor:
      rows.length > CATALOG_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
  };
}

/**
 * Page d'une annonce : visible si approuvée (acheteurs), ou pour son vendeur
 * et l'équipe Get iT quel que soit son statut.
 */
export async function getListing(
  viewerId: string,
  listingId: string,
): Promise<ListingDetail | null> {
  const row = await db.listing.findUnique({
    where: { id: listingId },
    select: {
      ...summarySelect,
      sellerId: true,
      status: true,
      description: true,
      website: true,
      socialUrl: true,
      reviewNote: true,
      createdAt: true,
    },
  });
  if (!row) return null;
  const mine = row.sellerId === viewerId;
  if (!mine && !(await isAdmin(viewerId))) {
    const blocked = await getBlockedIds(viewerId);
    const visible = await db.listing.count({
      where: { id: listingId, ...visibleWhere(blocked) },
    });
    if (visible === 0) return null;
  }
  const [photoMap, seller, favorites] = await Promise.all([
    photosFor([row.id], false),
    sellerAvatars([row]),
    favoriteIdsAmong(viewerId, [row.id]),
  ]);
  const photos = photoMap.get(row.id) ?? [];
  return {
    ...row,
    seller: seller(row.seller),
    createdAt: row.createdAt.toISOString(),
    photo: photos[0] ?? null,
    favorite: favorites.has(row.id),
    photos,
    mine,
    reviewNote: mine ? row.reviewNote : null,
  };
}

/** Annonces du vendeur, tous statuts confondus. */
export async function listMyListings(userId: string) {
  const rows = await db.listing.findMany({
    where: { sellerId: userId },
    orderBy: { createdAt: "desc" },
    select: { ...summarySelect, status: true, reviewNote: true },
  });
  const [photos, seller] = await Promise.all([
    photosFor(
      rows.map((row) => row.id),
      true,
    ),
    sellerAvatars(rows),
  ]);
  return rows.map((row) => ({
    ...row,
    seller: seller(row.seller),
    photo: photos.get(row.id)?.[0] ?? null,
    favorite: false,
  }));
}

/** Annonces gardées en favori parmi `listingIds`. */
async function favoriteIdsAmong(userId: string, listingIds: string[]) {
  if (listingIds.length === 0) return new Set<string>();
  const rows = await db.listingFavorite.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((row) => row.listingId));
}

/**
 * Ajoute une annonce visible à « Mes favoris », ou l'en retire. Privé : le
 * vendeur ne sait pas qui garde son annonce.
 */
export async function setFavorite(
  userId: string,
  listingId: string,
  on: boolean,
): Promise<{ ok: true } | { ok: false; error: "notFound" | "favoritesLimit" }> {
  if (!on) {
    await db.listingFavorite.deleteMany({ where: { userId, listingId } });
    return { ok: true };
  }
  const blocked = await getBlockedIds(userId);
  const visible = await db.listing.count({
    where: { id: listingId, ...visibleWhere(blocked) },
  });
  if (visible === 0) return { ok: false, error: "notFound" };
  const count = await db.listingFavorite.count({ where: { userId } });
  if (count >= FAVORITES_MAX) return { ok: false, error: "favoritesLimit" };
  await db.listingFavorite.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId },
    update: {},
  });
  return { ok: true };
}

/** « Mes favoris » : les annonces gardées et toujours visibles, la plus récente d'abord. */
export async function listFavorites(userId: string): Promise<ListingSummary[]> {
  const blocked = await getBlockedIds(userId);
  const rows = await db.listingFavorite.findMany({
    where: { userId, listing: visibleWhere(blocked) },
    orderBy: { createdAt: "desc" },
    take: FAVORITES_MAX,
    select: { listing: { select: summarySelect } },
  });
  const listings = rows.map((row) => row.listing);
  const [photos, seller] = await Promise.all([
    photosFor(
      listings.map((listing) => listing.id),
      true,
    ),
    sellerAvatars(listings),
  ]);
  return listings.map((listing) => ({
    ...listing,
    seller: seller(listing.seller),
    photo: photos.get(listing.id)?.[0] ?? null,
    favorite: true,
  }));
}

/** Choix du type de compte (inscription ou Réglages). */
export async function setAccountType(userId: string, type: AccountType) {
  await db.profile.update({
    where: { id: userId },
    data: { accountType: type },
  });
}

/** Autorisations d'envoi des photos d'une future annonce (photos seulement). */
export async function requestListingUploads(
  userId: string,
  files: UploadRequest,
): Promise<{ ok: true; slots: UploadSlot[] } | Fail> {
  const allowed = await canSell(userId);
  if (!allowed.ok) return allowed;
  if (
    files.some((file) => file.poster || !file.mimeType.startsWith("image/"))
  ) {
    return { ok: false, error: "mediaType" };
  }
  const result = await requestUploads(userId, files);
  return result.ok
    ? result
    : { ok: false, error: asMarketplaceError(result.error) };
}

/** Soumet une annonce : elle attend l'approbation de l'équipe Get iT. */
export async function createListing(
  userId: string,
  input: ListingInput,
): Promise<{ ok: true; id: string } | Fail> {
  const allowed = await canSell(userId);
  if (!allowed.ok) return allowed;
  const active = await db.listing.count({
    where: { sellerId: userId, status: { in: ["pending", "approved"] } },
  });
  if (active >= MAX_ACTIVE_LISTINGS)
    return { ok: false, error: "listingLimit" };
  const recent = await db.listing.count({
    where: {
      sellerId: userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recent >= DAILY_LISTINGS) return { ok: false, error: "dailyLimit" };

  // Photos vérifiées dans le stockage avant d'écrire quoi que ce soit
  const verified = await verifyMedia(userId, input.media);
  if (!verified.ok) {
    return { ok: false, error: asMarketplaceError(verified.error) };
  }
  const { rows, uploadIds } = verified.media;
  if (rows.some((row) => row.kind !== "image")) {
    return { ok: false, error: "mediaType" };
  }

  const service = input.kind === "service" ? input : null;
  const id = await db.$transaction(
    async (tx) => {
      const listing = await tx.listing.create({
        data: {
          sellerId: userId,
          kind: input.kind,
          pillar: input.pillar,
          category: input.category,
          title: input.title,
          summary: input.summary,
          description: input.description,
          priceMinCents: input.priceMin,
          priceMaxCents: service?.priceMax ?? null,
          priceUnit: service?.priceUnit ?? "item",
          regions: service?.regions ?? [],
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          website: input.website,
          socialUrl: input.socialUrl,
          licenseNumber: service?.licenseNumber ?? null,
          mediaCount: rows.length,
        },
        select: { id: true },
      });
      if (rows.length > 0) {
        await tx.listingMedia.createMany({
          data: rows.map((row) => ({
            listingId: listing.id,
            path: row.path,
            width: row.width,
            height: row.height,
            sizeBytes: row.sizeBytes,
            position: row.position,
          })),
        });
        const { count } = await tx.mediaUpload.updateMany({
          where: { id: { in: uploadIds }, userId, usedAt: null },
          data: { usedAt: new Date() },
        });
        // Un même envoi ne sert qu'une fois
        if (count !== uploadIds.length) throw new Error("Média déjà utilisé");
      }
      return listing.id;
      // Trois écritures vers la base distante : la limite de 5 s par défaut a
      // été dépassée quand le serveur était chargé
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  return { ok: true, id };
}

/** Le vendeur retire son annonce (photos comprises). */
export async function deleteListing(userId: string, listingId: string) {
  const listing = await db.listing.findFirst({
    where: { id: listingId, sellerId: userId },
    select: { id: true, media: { select: { path: true } } },
  });
  if (!listing) return false;
  await db.listing.delete({ where: { id: listing.id } });
  await removeFiles(listing.media.map((item) => item.path)).catch(
    () => undefined,
  );
  return true;
}

/** File d'approbation de l'équipe Get iT (plus anciennes d'abord). */
export async function listPendingListings(
  adminId: string,
): Promise<ListingForReview[] | null> {
  if (!(await isAdmin(adminId))) return null;
  const rows = await db.listing.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      ...summarySelect,
      sellerId: true,
      status: true,
      description: true,
      website: true,
      socialUrl: true,
      reviewNote: true,
      createdAt: true,
      contactName: true,
      contactEmail: true,
      licenseNumber: true,
    },
  });
  const [photos, seller] = await Promise.all([
    photosFor(
      rows.map((row) => row.id),
      false,
    ),
    sellerAvatars(rows),
  ]);
  return rows.map((row) => {
    const list = photos.get(row.id) ?? [];
    return {
      ...row,
      seller: seller(row.seller),
      createdAt: row.createdAt.toISOString(),
      photo: list[0] ?? null,
      photos: list,
      mine: row.sellerId === adminId,
      favorite: false,
    };
  });
}

/** Nombre d'annonces en attente (lien de l'équipe dans le Marketplace). */
export async function countPendingListings(adminId: string) {
  if (!(await isAdmin(adminId))) return null;
  return db.listing.count({ where: { status: "pending" } });
}

/** Décision de l'équipe : approuver, ou refuser avec une raison montrée au vendeur. */
export async function reviewListing(
  adminId: string,
  listingId: string,
  approve: boolean,
  note: string | null,
) {
  if (!(await isAdmin(adminId))) return false;
  const { count } = await db.listing.updateMany({
    where: { id: listingId, status: "pending" },
    data: {
      status: approve ? "approved" : "rejected",
      reviewNote: approve ? null : note,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  });
  return count === 1;
}
