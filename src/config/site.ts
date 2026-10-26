import { z } from "zod";

// Sur Vercel, sans NEXT_PUBLIC_APP_URL : l'adresse de production du projet
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

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
  themeColor: "#0a0a0b",
} as const;
