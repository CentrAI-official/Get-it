import { z } from "zod";

// Sur Vercel, sans NEXT_PUBLIC_APP_URL : l'adresse de production du projet.
// VERCEL_PROJECT_PRODUCTION_URL est toujours fournie au serveur (build et
// exécution) ; la variante NEXT_PUBLIC_ ne l'est pas selon le réglage du projet.
// siteConfig n'est lu que côté serveur (metadataBase, liens des courriels).
const vercelUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

const appUrl = z
  .url()
  .default("http://localhost:3000")
  .parse(
    process.env.NEXT_PUBLIC_APP_URL ||
      (vercelUrl ? `https://${vercelUrl}` : undefined),
  );

export const siteConfig = {
  name: "Get iT",
  url: appUrl,
} as const;
