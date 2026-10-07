import { z } from "zod";

const appUrl = z
  .url()
  .default("http://localhost:3000")
  .parse(process.env.NEXT_PUBLIC_APP_URL || undefined);

export const siteConfig = {
  name: "Get iT",
  url: appUrl,
  themeColor: "#0a0a0b",
} as const;
