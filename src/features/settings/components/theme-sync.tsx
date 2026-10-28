"use client";

import { useEffect } from "react";
import type { ThemePreference } from "@/config/theme";
import { applyThemePreference, readThemePreference } from "../theme-client";

/**
 * Aligne ce navigateur sur le thème du compte : un choix fait sur un autre
 * appareil s'applique ici au prochain chargement de l'application.
 */
export function ThemeSync({ theme }: { theme: ThemePreference }) {
  useEffect(() => {
    if (readThemePreference() !== theme) applyThemePreference(theme);
  }, [theme]);
  return null;
}
