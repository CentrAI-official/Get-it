import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ERROR_SOURCES,
  clientErrorSchema,
  routeFromRoutePath,
  scrubErrorMessage,
} from "@/features/analytics/errors";
import { ANALYTICS_ENVS } from "@/features/analytics/rules";
import {
  FEEDBACK_KINDS,
  FEEDBACK_TOPICS,
  WEEK_KIND,
  feedbackSchema,
  isWeekQuestionDue,
  weekAnswerSchema,
} from "./rules";

const sql = readFileSync(
  new URL(
    "../../../prisma/migrations/20261110120000_feedback_errors/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const list = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");

describe("avis des membres", () => {
  it("revalide un avis : un type connu et quelques mots", () => {
    expect(
      feedbackSchema.safeParse({
        kind: "idea",
        body: "  Un mode hors ligne  ",
        locale: "fr",
      }),
    ).toMatchObject({ success: true, data: { body: "Un mode hors ligne" } });
    expect(
      feedbackSchema.safeParse({ kind: "idea", body: "ok", locale: "fr" })
        .success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({ kind: "rant", body: "Bonjour", locale: "fr" })
        .success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({
        kind: "idea",
        body: "x".repeat(1001),
        locale: "fr",
      }).success,
    ).toBe(false);
  });

  it("la réponse d'une semaine : un sujet, une précision facultative", () => {
    expect(weekAnswerSchema.parse({ topic: "journal", body: "  " })).toEqual({
      topic: "journal",
      body: null,
    });
    expect(
      weekAnswerSchema.safeParse({ topic: "nope", body: "" }).success,
    ).toBe(false);
  });

  it("pose la question une fois, après 7 jours", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
    expect(isWeekQuestionDue(days(8), null, now)).toBe(true);
    expect(isWeekQuestionDue(days(6), null, now)).toBe(false);
    expect(isWeekQuestionDue(days(30), days(1), now)).toBe(false);
  });

  it("la migration suit les listes et active le RLS", () => {
    expect(sql).toContain(
      `"kind" IN (${list([...FEEDBACK_KINDS, WEEK_KIND])})`,
    );
    expect(sql).toContain(`"topic" IN (${list(FEEDBACK_TOPICS)})`);
    expect(sql).toContain(`"source" IN (${list(ERROR_SOURCES)})`);
    expect(sql).toContain(`"env" IN (${list(ANALYTICS_ENVS)})`);
    expect(sql).toContain('ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "app_errors" ENABLE ROW LEVEL SECURITY');
  });
});

describe("erreurs de l'application", () => {
  it("retire les données personnelles du message", () => {
    expect(
      scrubErrorMessage(
        "TypeError",
        "Cannot read user marie.tremblay@example.com of 0192f3a4-5b6c-7d8e-9f01-23456789abcd at https://get-it.app/fr/goals/123456 (code 98765)",
      ),
    ).toBe(
      "TypeError: Cannot read user [courriel] of [id] at [lien] (code [n])",
    );
    expect(scrubErrorMessage(undefined, "  ")).toBe("—");
    expect(scrubErrorMessage("Error", "Boom")).toBe("Boom");
    expect(scrubErrorMessage(undefined, "x".repeat(500))).toHaveLength(300);
  });

  it("ramène un fichier de l'App Router à son modèle de route", () => {
    expect(
      routeFromRoutePath("/[locale]/(app)/community/posts/[id]/page"),
    ).toBe("/community/posts/[id]");
    expect(routeFromRoutePath("/app/[locale]/(app)/settings/page")).toBe(
      "/settings",
    );
    expect(routeFromRoutePath("/app/api/v1/errors/route")).toBe(
      "/api/v1/errors",
    );
  });

  it("refuse une erreur mal formée ou avec des champs inconnus", () => {
    const ok = { message: "Boom", path: "/fr/community" };
    expect(clientErrorSchema.safeParse(ok).success).toBe(true);
    expect(clientErrorSchema.safeParse({ ...ok, user: "x" }).success).toBe(
      false,
    );
    expect(clientErrorSchema.safeParse({ ...ok, path: "fr" }).success).toBe(
      false,
    );
  });
});
