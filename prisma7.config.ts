import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Charge .env.local (et les autres fichiers .env*) exactement comme Next.js
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Les migrations passent par une connexion directe, pas par le pooler transactionnel
    url: process.env["DIRECT_URL"],
  },
});
