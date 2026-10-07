import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = "prisma/migrations";

/** SQL de toutes les migrations, dans l'ordre d'application. */
function readMigrations() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) =>
      readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"),
    )
    .join("\n");
}

function matchTables(sql: string, pattern: RegExp) {
  return new Set([...sql.matchAll(pattern)].map((match) => match[1]));
}

describe("migrations", () => {
  const sql = readMigrations();

  it("activent le RLS sur chaque table créée", () => {
    const created = matchTables(sql, /CREATE TABLE "(\w+)"/g);
    const protectedTables = matchTables(
      sql,
      /ALTER TABLE "(\w+)" ENABLE ROW LEVEL SECURITY/g,
    );
    const missing = [...created].filter((table) => !protectedTables.has(table));

    expect(created.size).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("protègent aussi la table interne de Prisma", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\._prisma_migrations ENABLE ROW LEVEL SECURITY/,
    );
  });

  it("ne désactivent jamais le RLS", () => {
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/);
  });
});
