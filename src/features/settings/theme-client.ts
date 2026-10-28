import {
  THEME_COOKIE,
  themeFromCookie,
  type ThemePreference,
} from "@/config/theme";

declare global {
  interface Window {
    /** Défini par THEME_SCRIPT : réapplique le thème du cookie. */
    getitApplyTheme?: () => void;
  }
}

/** Préférence gardée dans ce navigateur. */
export function readThemePreference(): ThemePreference {
  return themeFromCookie(document.cookie);
}

/** Garde le choix dans le cookie (un an ; « system » le retire) et l'applique aussitôt. */
export function applyThemePreference(theme: ThemePreference) {
  document.cookie =
    theme === "system"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  window.getitApplyTheme?.();
}
