import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canSeePlan,
  CLIENT_LIMITS,
  noteSchema,
  orderedShares,
  sharesSchema,
  SHAREABLE_KINDS,
} from "./rules";

const migration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20261122120000_page_clients/migration.sql",
  ),
  "utf8",
);

describe("sharesSchema", () => {
  it("garde les plans choisis, sans doublon", () => {
    const shares = sharesSchema.parse({
      kinds: ["physical", "nutrition", "physical"],
    });
    expect(shares.kinds).toEqual(["physical", "nutrition"]);
    expect(shares.mentalConsent).toBe(false);
  });

  it("refuse le plan mental sans accord explicite", () => {
    const result = sharesSchema.safeParse({ kinds: ["mental"] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("mentalConsentRequired");
    expect(
      sharesSchema.safeParse({ kinds: ["mental"], mentalConsent: true })
        .success,
    ).toBe(true);
  });

  it("refuse le plan d'entreprise (retiré) et les inconnus", () => {
    expect(sharesSchema.safeParse({ kinds: ["business"] }).success).toBe(false);
    expect(sharesSchema.safeParse({ kinds: ["journal"] }).success).toBe(false);
  });
});

describe("canSeePlan", () => {
  const active = {
    status: "active" as const,
    sharedKinds: ["physical", "mental"] as const,
    mentalConsentAt: new Date(),
  };

  it("seulement pendant un suivi en cours, et seulement ce qui est partagé", () => {
    expect(
      canSeePlan(
        { ...active, sharedKinds: [...active.sharedKinds] },
        "physical",
      ),
    ).toBe(true);
    expect(
      canSeePlan(
        { ...active, sharedKinds: [...active.sharedKinds] },
        "financial",
      ),
    ).toBe(false);
    for (const status of ["invited", "requested", "ended"] as const) {
      expect(
        canSeePlan(
          { ...active, status, sharedKinds: [...active.sharedKinds] },
          "physical",
        ),
      ).toBe(false);
    }
  });

  it("le plan mental seulement avec l'accord", () => {
    expect(
      canSeePlan(
        { ...active, sharedKinds: ["mental"], mentalConsentAt: null },
        "mental",
      ),
    ).toBe(false);
    expect(canSeePlan({ ...active, sharedKinds: ["mental"] }, "mental")).toBe(
      true,
    );
  });
});

describe("orderedShares", () => {
  it("dans l'ordre de l'application, sans le plan d'entreprise", () => {
    expect(orderedShares(["financial", "business", "physical"])).toEqual([
      "physical",
      "financial",
    ]);
  });
});

describe("noteSchema", () => {
  it("refuse une note vide ou trop longue", () => {
    expect(noteSchema.safeParse("   ").success).toBe(false);
    expect(
      noteSchema.safeParse("x".repeat(CLIENT_LIMITS.note + 1)).success,
    ).toBe(false);
    expect(noteSchema.parse("  Bonne séance  ")).toBe("Bonne séance");
  });
});

describe("alignement avec la migration", () => {
  it("les plans partageables et les limites sont ceux de la base", () => {
    const kinds = /ARRAY\[([^\]]+)\]::"DevelopmentKind"\[\]/.exec(migration);
    expect(
      kinds?.[1]?.match(/'([a-z]+)'/g)?.map((kind) => kind.slice(1, -1)),
    ).toEqual([...SHAREABLE_KINDS]);
    expect(migration).toContain(
      `char_length("message") <= ${CLIENT_LIMITS.message}`,
    );
    expect(migration).toContain(`char_length("body") <= ${CLIENT_LIMITS.note}`);
  });
});
