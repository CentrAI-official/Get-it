import { describe, expect, it } from "vitest";
import {
  commentSchema,
  firstCommunityError,
  joinCommunitySchema,
  POST_MAX_LENGTH,
  postFormSchema,
  progressDataSchema,
  progressShareSchema,
  reportSchema,
  usernameSchema,
} from "./rules";

const id = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

/** Clé de message de la première erreur, comme l'affiche le formulaire. */
function errorOf(result: { success: boolean; error?: unknown }) {
  if (result.success) return null;
  return firstCommunityError(
    result.error as Parameters<typeof firstCommunityError>[0],
  );
}

describe("usernameSchema", () => {
  it("met le nom en minuscules et retire les espaces autour", () => {
    expect(usernameSchema.parse("  Max_Pidg21 ")).toBe("max_pidg21");
  });

  it("refuse les noms trop courts, trop longs ou avec d'autres caractères", () => {
    for (const name of ["ab", "a".repeat(21), "max pidg", "max-pidg", "élan"]) {
      expect(errorOf(usernameSchema.safeParse(name))).toBe("usernameInvalid");
    }
  });

  it("réserve les noms qui feraient croire à un compte officiel", () => {
    for (const name of ["admin", "GetIt", "Moderateur", "support"]) {
      expect(errorOf(usernameSchema.safeParse(name))).toBe("usernameReserved");
    }
  });
});

describe("joinCommunitySchema", () => {
  it("exige l'acceptation des règles", () => {
    expect(
      errorOf(joinCommunitySchema.safeParse({ locale: "fr", username: "max" })),
    ).toBe("rulesRequired");
    expect(
      joinCommunitySchema.parse({ locale: "fr", username: "Max", rules: "on" }),
    ).toEqual({ locale: "fr", username: "max", rules: "on" });
  });
});

describe("postFormSchema", () => {
  const base = { locale: "fr", kind: "text", pillar: "" };

  it("accepte une publication sans pilier", () => {
    expect(postFormSchema.parse({ ...base, body: "  Bonjour  " })).toEqual({
      locale: "fr",
      kind: "text",
      body: "Bonjour",
      pillar: undefined,
    });
  });

  it("refuse un texte vide ou trop long", () => {
    expect(errorOf(postFormSchema.safeParse({ ...base, body: "   " }))).toBe(
      "bodyRequired",
    );
    expect(
      errorOf(
        postFormSchema.safeParse({
          ...base,
          body: "a".repeat(POST_MAX_LENGTH + 1),
        }),
      ),
    ).toBe("bodyTooLong");
  });

  it("n'accepte pas un progrès écrit à la main", () => {
    expect(
      postFormSchema.safeParse({ ...base, kind: "progress", body: "Niveau 99" })
        .success,
    ).toBe(false);
  });
});

describe("progressShareSchema", () => {
  it("ne reçoit qu'une référence : le serveur retrouve et fige le progrès", () => {
    expect(
      progressShareSchema.parse({
        locale: "fr",
        source: { type: "goal", id, title: "Niveau 99" },
      }),
    ).toEqual({ locale: "fr", source: { type: "goal", id }, body: "" });
    expect(
      progressShareSchema.parse({ locale: "en", source: { type: "level" } })
        .source,
    ).toEqual({ type: "level" });
  });

  it("refuse une source inconnue ou sans identifiant", () => {
    expect(
      progressShareSchema.safeParse({
        locale: "fr",
        source: { type: "badge", id },
      }).success,
    ).toBe(false);
    expect(
      progressShareSchema.safeParse({
        locale: "fr",
        source: { type: "streak" },
      }).success,
    ).toBe(false);
  });
});

describe("commentSchema", () => {
  it("retire les espaces et refuse un commentaire vide", () => {
    expect(commentSchema.parse("  Bravo!  ")).toBe("Bravo!");
    expect(errorOf(commentSchema.safeParse(" "))).toBe("bodyRequired");
  });
});

describe("reportSchema", () => {
  it("vise une seule cible avec une raison connue", () => {
    expect(
      reportSchema.parse({
        target: { type: "comment", id },
        reason: "harassment",
        details: "  insultes  ",
      }),
    ).toEqual({
      target: { type: "comment", id },
      reason: "harassment",
      details: "insultes",
    });
    expect(
      reportSchema.safeParse({ target: { type: "post", id }, reason: "boring" })
        .success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        target: { type: "post", id: "42" },
        reason: "spam",
      }).success,
    ).toBe(false);
  });
});

describe("progressDataSchema", () => {
  it("lit chaque forme de progrès figé", () => {
    for (const progress of [
      { type: "goal", title: "Demi-marathon", pillar: "physical" },
      {
        type: "milestone",
        title: "10 km",
        goalTitle: "Demi-marathon",
        pillar: "physical",
      },
      { type: "streak", title: "Lire", days: 12, pillar: "mental" },
      { type: "level", level: 4 },
    ]) {
      expect(progressDataSchema.parse(progress)).toEqual(progress);
    }
  });

  it("refuse une série nulle ou un pilier inconnu", () => {
    expect(
      progressDataSchema.safeParse({
        type: "streak",
        title: "Lire",
        days: 0,
        pillar: "mental",
      }).success,
    ).toBe(false);
    expect(
      progressDataSchema.safeParse({
        type: "goal",
        title: "Demi-marathon",
        pillar: "spiritual",
      }).success,
    ).toBe(false);
  });
});

describe("firstCommunityError", () => {
  it("réduit une erreur inconnue à « unexpected »", () => {
    expect(errorOf(reportSchema.safeParse({}))).toBe("unexpected");
  });
});
