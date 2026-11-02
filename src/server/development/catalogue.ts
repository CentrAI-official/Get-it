import "server-only";
import {
  catalogueFor,
  PLAN_LIBRARY,
  recipeAllowed,
} from "@/features/development/catalogue";
import type {
  Answers,
  DevelopmentKind,
} from "@/features/development/questionnaires";
import { db } from "@/server/db";

/**
 * Catalogue envoyé à Get iT AI pour un plan : les éléments publiés de son
 * type ; pour la nutrition, seulement les recettes sans allergie déclarée et
 * conformes au régime. Vide pour le plan financier.
 */
export async function planCatalogue(kind: DevelopmentKind, answers: Answers) {
  const library = PLAN_LIBRARY[kind];
  if (!library) return { text: "", codes: new Map<string, string>() };
  const rows = await db.libraryItem.findMany({
    where: { kind: library.kind, pillar: library.pillar, status: "published" },
    orderBy: { title: "asc" },
    select: { id: true, title: true, tags: true, minutes: true },
  });
  const entries =
    kind === "nutrition"
      ? rows.filter((row) => recipeAllowed(row.tags, answers))
      : rows;
  return catalogueFor(library.kind, entries);
}
