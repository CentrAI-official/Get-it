import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PILLARS } from "@/config/pillars";
import { OCCUPATIONS } from "@/features/onboarding/schemas";

const schema = readFileSync("prisma/schema.prisma", "utf8");

function enumValues(name: string) {
  return schema
    .match(new RegExp(`enum ${name} \\{([^}]*)\\}`))?.[1]
    ?.split(/\s+/)
    .filter(Boolean);
}

describe("enums de la base de données", () => {
  it("Pillar correspond aux piliers de l'application", () => {
    expect(enumValues("Pillar")).toEqual([...PILLARS]);
  });

  it("Occupation correspond aux choix de l'onboarding", () => {
    expect(enumValues("Occupation")).toEqual([...OCCUPATIONS]);
  });
});
