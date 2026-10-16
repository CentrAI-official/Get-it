import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin({
  experimental: {
    // Types stricts des messages, générés à partir de la langue source (français)
    createMessagesDeclaration: "./messages/fr.json",
  },
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Développement seulement : ouvrir le serveur de dev depuis un téléphone du
  // même réseau Wi-Fi (npm run dev:mobile). Sans effet en production.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // L'ancienne page Aujourd'hui est devenue le popup « Ma journée »
    return [
      {
        source: "/:locale(fr|en)/today",
        destination: "/:locale/community",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
