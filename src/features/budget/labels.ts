import type { CategoryInfo } from "./categories";

/** Le nom d'une catégorie : traduit pour celles de Get iT, tel quel pour une personnelle. */
export function categoryName(
  t: (key: "categories.other") => string,
  categories: readonly CategoryInfo[],
  key: string | null,
) {
  const info = categories.find((entry) => entry.key === key);
  if (info?.name) return info.name;
  return t(
    (info
      ? `categories.${info.key}`
      : "categories.other") as "categories.other",
  );
}
