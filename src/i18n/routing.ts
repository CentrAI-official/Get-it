import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  // Langue de repli quand celle du navigateur n'est pas supportée
  defaultLocale: "fr",
  // Le choix de langue est mémorisé un an (cookie de préférence)
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
});
