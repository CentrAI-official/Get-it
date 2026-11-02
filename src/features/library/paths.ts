import type { LibraryKind, LibraryPillar } from "./rules";

/** Page de la liste d'un type du catalogue, dans sa section de Mon développement. */
export function libraryListPath(
  kind: LibraryKind,
  pillar: LibraryPillar,
): `/${string}` {
  if (kind === "exercise") return "/services/physical/training/exercises";
  if (kind === "recipe") return "/services/physical/nutrition/recipes";
  return `/services/${pillar === "social" ? "social" : "mental"}/tools`;
}

/** Fiche d'un élément du catalogue. */
export const libraryItemPath = (id: string): `/${string}` =>
  `/services/library/${id}`;
