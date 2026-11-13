import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXCLUDED_MODELS, EXPORTED } from "./export-tables";

const schema = readFileSync(
  join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);
const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(
  ([, name, body]) => ({ name: name ?? "", body: body ?? "" }),
);

describe("Télécharger mes données (Loi 25)", () => {
  it("chaque table liée à un membre est exportée, ou exclue pour une raison écrite", () => {
    const exported = new Set(EXPORTED.map((source) => source.model));
    const linked = models
      .filter(({ body }) => /^\s+\w+\s+Profile\??\s+@relation/m.test(body))
      .map(({ name }) => name);
    const missing = linked.filter(
      (name) => !exported.has(name) && !(name in EXCLUDED_MODELS),
    );
    expect(missing).toEqual([]);
  });

  it("chaque requête lit une table qui existe, par l'identifiant de la personne", () => {
    const tables = new Set(
      models.map(({ body }) => body.match(/@@map\("(\w+)"\)/)?.[1]),
    );
    for (const source of EXPORTED) {
      const table = source.sql.match(/FROM "(\w+)"/)?.[1];
      expect(tables.has(table), source.key).toBe(true);
      expect(source.sql).toContain("$1::uuid");
    }
  });

  it("les clés du fichier sont uniques", () => {
    const keys = EXPORTED.map((source) => source.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
