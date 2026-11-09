"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { searchPlaces } from "@/server/places/service";
import { placeQuerySchema, type PlaceSuggestion } from "./rules";

/** Adresses proposées pendant qu'on tape un lieu (session obligatoire). */
export async function searchPlacesAction(
  query: unknown,
  locale: unknown,
  maxLength: unknown,
): Promise<PlaceSuggestion[]> {
  const user = await requireUser();
  const parsed = placeQuerySchema.safeParse(query);
  const lang = z.enum(["fr", "en"]).safeParse(locale);
  const max = z.number().int().min(20).max(300).safeParse(maxLength);
  if (!parsed.success || !lang.success || !max.success) return [];
  return searchPlaces(user.id, parsed.data, lang.data, max.data);
}
