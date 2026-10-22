"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { uploadRequestSchema } from "@/features/community/media";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import {
  createListing,
  deleteListing,
  listCatalog,
  requestListingUploads,
  reviewListing,
  setAccountType,
} from "@/server/marketplace/service";
import {
  ACCOUNT_TYPES,
  catalogFiltersSchema,
  LISTING_KINDS,
  listingInputSchema,
  type MarketplaceError,
} from "./rules";

// Points d'entrée publics : session et entrées revalidées ici ; le service
// vérifie le type de compte, l'adhésion au Centre et le rôle de l'équipe.

export type ListingFormResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: MarketplaceError;
      /** Champ → code d'erreur (ex. « licenseRequired »), pour le formulaire. */
      fields?: Record<string, string>;
    };

export async function setAccountTypeAction(type: unknown) {
  const user = await requireUser();
  const parsed = z.enum(ACCOUNT_TYPES).safeParse(type);
  if (!parsed.success) return false;
  await setAccountType(user.id, parsed.data);
  refresh();
  return true;
}

export async function requestListingUploadsAction(files: unknown) {
  const user = await requireUser();
  const parsed = uploadRequestSchema.safeParse(files);
  if (!parsed.success)
    return { ok: false as const, error: "mediaType" as const };
  try {
    return await requestListingUploads(user.id, parsed.data);
  } catch (error) {
    console.error("Envoi de photos impossible (annonce)", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

export async function createListingAction(
  input: unknown,
): Promise<ListingFormResult> {
  const user = await requireUser();
  const parsed = listingInputSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fields[key] ??= issue.code === "custom" ? issue.message : issue.code;
    }
    return { ok: false, error: "invalid", fields };
  }
  try {
    const result = await createListing(user.id, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Annonce impossible à créer", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function deleteListingAction(listingId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(listingId);
  if (!id.success) return false;
  const done = await deleteListing(user.id, id.data).catch(() => false);
  if (done) refresh();
  return done;
}

const reviewSchema = z.object({
  listingId: recordIdSchema,
  approve: z.boolean(),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
});

export async function reviewListingAction(input: unknown) {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return false;
  const { listingId, approve, note } = parsed.data;
  const done = await reviewListing(user.id, listingId, approve, note).catch(
    () => false,
  );
  if (done) refresh();
  return done;
}

/** « Voir plus » du catalogue. */
export async function loadMoreListingsAction(
  kind: unknown,
  filters: unknown,
  cursor: unknown,
) {
  const user = await requireUser();
  const parsedKind = z.enum(LISTING_KINDS).safeParse(kind);
  const parsedCursor = recordIdSchema.safeParse(cursor);
  if (!parsedKind.success || !parsedCursor.success) return null;
  return listCatalog(
    user.id,
    parsedKind.data,
    catalogFiltersSchema.parse(filters ?? {}),
    parsedCursor.data,
  ).catch(() => null);
}
