import { createElement } from "react";
import type { CategoryInfo } from "../categories";
import { iconOfCategory } from "../icons";

/** L'icône d'une catégorie (dans une page du serveur ou une fenêtre). */
export function CategoryIcon({
  category,
  categories,
  className,
}: {
  category: string | null;
  categories: readonly CategoryInfo[];
  className?: string;
}) {
  return createElement(iconOfCategory(category, categories), {
    "aria-hidden": true,
    className,
  });
}
