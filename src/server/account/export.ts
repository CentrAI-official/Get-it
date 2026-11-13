import "server-only";
import { db } from "@/server/db";
import { EXPORTED } from "./export-tables";

// « Télécharger mes données » (Loi 25, droit à la portabilité, analyse du
// 2026-11-12) : tout ce que Get iT garde sur la personne, dans un fichier JSON.
// Les tables sont dans export-tables.ts. Les photos et vidéos n'y sont pas.

/** Ce que Get iT garde sur la personne, en texte JSON (les grands nombres en texte). */
export async function exportAccount(userId: string) {
  const [profile, ...tables] = await Promise.all([
    db.$queryRawUnsafe<unknown[]>(
      `SELECT * FROM "profiles" WHERE "id" = $1::uuid`,
      userId,
    ),
    ...EXPORTED.map((source) =>
      db.$queryRawUnsafe<unknown[]>(source.sql, userId),
    ),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    profile: profile[0] ?? null,
    ...Object.fromEntries(
      EXPORTED.map((source, index) => [source.key, tables[index] ?? []]),
    ),
  };
  return JSON.stringify(
    data,
    (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    2,
  );
}
