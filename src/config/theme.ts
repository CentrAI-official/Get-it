// Thème de l'interface : clair, sombre, ou selon l'appareil (« system »).
// Le choix est gardé dans un cookie, lu avant l'affichage (sans clignotement),
// et dans le compte (UserSettings.theme) pour suivre l'utilisateur partout.

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const THEME_COOKIE = "theme";

/** Couleur de la barre du navigateur sur téléphone : le fond de chaque thème. */
export const THEME_COLORS = { light: "#f2efe8", dark: "#0e1220" } as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some((theme) => theme === value);
}

/** Préférence gardée dans le cookie : « system » quand il est absent ou invalide. */
export function themeFromCookie(cookie: string): ThemePreference {
  const match = new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)`).exec(
    cookie,
  );
  return match?.[1] === "light" || match?.[1] === "dark" ? match[1] : "system";
}

/**
 * Script exécuté avant l'affichage de la page (dans le <body> de la mise en page
 * racine) : applique le thème du cookie, ou celui de l'appareil, et suit les
 * changements de l'appareil. `window.getitApplyTheme` le réapplique après un choix.
 */
export const THEME_SCRIPT = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    var match = document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);
    var theme = match ? match[1] : media.matches ? "dark" : "light";
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    var color = theme === "dark" ? "${THEME_COLORS.dark}" : "${THEME_COLORS.light}";
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute("content", color);
    });
  }
  apply();
  media.addEventListener("change", apply);
  window.getitApplyTheme = apply;
})();`;
