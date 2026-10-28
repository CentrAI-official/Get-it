import { describe, expect, it } from "vitest";
import { isThemePreference, THEME_SCRIPT, themeFromCookie } from "./theme";

describe("thème de l'interface", () => {
  it("lit le choix dans le cookie, « system » sinon", () => {
    expect(themeFromCookie("")).toBe("system");
    expect(themeFromCookie("theme=dark")).toBe("dark");
    expect(themeFromCookie("NEXT_LOCALE=fr; theme=light; sb=1")).toBe("light");
    expect(themeFromCookie("theme=blue")).toBe("system");
    // Un autre cookie qui finit par « theme » ne compte pas
    expect(themeFromCookie("mytheme=dark")).toBe("system");
    expect(themeFromCookie("theme=darker")).toBe("system");
  });

  it("n'accepte que les trois choix", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });

  it("le script lit le même cookie que l'application", () => {
    expect(THEME_SCRIPT).toContain("(?:^|; )theme=(light|dark)(?:;|$)");
    expect(THEME_SCRIPT).toContain("window.getitApplyTheme = apply");
  });
});
