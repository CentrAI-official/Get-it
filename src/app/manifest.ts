import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { THEME_COLORS } from "@/config/theme";

// Application installable (écran d'accueil) : nécessaire sur iPhone pour les
// notifications sur le téléphone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: "Si tu le veux, tu peux l’avoir.",
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
