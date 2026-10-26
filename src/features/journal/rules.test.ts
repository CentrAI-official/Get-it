import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  average,
  countWords,
  excerpt,
  isEditableDay,
  JOURNAL_BODY_MAX_LENGTH,
  journalEntrySchema,
  journalStreak,
  periodRange,
  recapStats,
  shiftPeriod,
} from "./rules";

describe("journalEntrySchema", () => {
  it("garde le texte de la page, sans les espaces autour", () => {
    const parsed = journalEntrySchema.parse({
      day: "2026-10-22",
      body: "  Belle journée.\n\nDemain, le gym.  ",
    });
    expect(parsed.body).toBe("Belle journée.\n\nDemain, le gym.");
    expect(
      journalEntrySchema.parse({ day: "2026-10-22", body: "   " }).body,
    ).toBe("");
  });

  it("refuse une page trop longue ou un jour invalide", () => {
    expect(
      journalEntrySchema.safeParse({
        day: "2026-10-22",
        body: "a".repeat(JOURNAL_BODY_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      journalEntrySchema.safeParse({ day: "22/10/2026", body: "Allo" }).success,
    ).toBe(false);
  });
});

describe("countWords", () => {
  it("compte les mots de la page", () => {
    expect(countWords("Courir  5 km\nBonne journée")).toBe(5);
    expect(countWords("")).toBe(0);
  });
});

describe("isEditableDay", () => {
  it("aujourd'hui et les 7 jours précédents seulement", () => {
    expect(isEditableDay("2026-10-22", "2026-10-22")).toBe(true);
    expect(isEditableDay("2026-10-15", "2026-10-22")).toBe(true);
    expect(isEditableDay("2026-10-14", "2026-10-22")).toBe(false);
    expect(isEditableDay("2026-10-23", "2026-10-22")).toBe(false);
  });
});

describe("journalStreak", () => {
  it("compte les jours d'affilée jusqu'à aujourd'hui", () => {
    expect(
      journalStreak(["2026-10-20", "2026-10-21", "2026-10-22"], "2026-10-22"),
    ).toBe(3);
  });

  it("la page du jour pas encore écrite ne casse pas la série", () => {
    expect(journalStreak(["2026-10-20", "2026-10-21"], "2026-10-22")).toBe(2);
  });

  it("un jour manqué remet à zéro", () => {
    expect(journalStreak(["2026-10-19", "2026-10-21"], "2026-10-23")).toBe(0);
    expect(journalStreak([], "2026-10-22")).toBe(0);
  });
});

describe("periodRange et shiftPeriod", () => {
  it("semaine du lundi au dimanche", () => {
    // 2026-10-22 est un jeudi
    expect(periodRange("week", "2026-10-22")).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
    });
    expect(periodRange("week", "2026-10-25")).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
    });
  });

  it("mois complet, y compris février", () => {
    expect(periodRange("month", "2026-10-22")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(periodRange("month", "2028-02-10")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("passe à la période précédente ou suivante", () => {
    expect(shiftPeriod("week", "2026-10-22", -1)).toBe("2026-10-12");
    expect(shiftPeriod("week", "2026-10-22", 1)).toBe("2026-10-26");
    expect(shiftPeriod("month", "2026-03-31", -1)).toBe("2026-02-01");
    expect(shiftPeriod("month", "2026-12-15", 1)).toBe("2027-01-01");
  });
});

describe("recapStats", () => {
  it("jours écrits, jours écoulés, mots et moyennes", () => {
    expect(
      recapStats({
        from: "2026-10-19",
        to: "2026-10-25",
        today: "2026-10-22",
        entries: [
          { day: "2026-10-19", words: 120 },
          { day: "2026-10-21", words: 80 },
        ],
        checkIns: [
          { mood: 4, energy: 3 },
          { mood: 3, energy: 4 },
          { mood: 4, energy: 4 },
        ],
      }),
    ).toEqual({ written: 2, elapsed: 4, words: 200, mood: 3.7, energy: 3.7 });
  });

  it("période passée complète, sans check-in", () => {
    const stats = recapStats({
      from: "2026-09-01",
      to: "2026-09-30",
      today: "2026-10-22",
      entries: [],
      checkIns: [],
    });
    expect(stats).toMatchObject({
      written: 0,
      elapsed: 30,
      mood: null,
      energy: null,
    });
  });
});

describe("average et excerpt", () => {
  it("arrondit au dixième", () => {
    expect(average([4, 4, 3])).toBe(3.7);
    expect(average([])).toBeNull();
  });

  it("début de la page, sur une ligne", () => {
    expect(excerpt("Ligne 1\nligne 2")).toBe("Ligne 1 ligne 2");
    expect(excerpt("a".repeat(200), 10)).toBe("aaaaaaaaa…");
  });
});

describe("contraintes de la base", () => {
  it("même limite que la migration", () => {
    const sql = readFileSync(
      "prisma/migrations/20261028120000_journal_free_page/migration.sql",
      "utf8",
    );
    expect(sql).toContain(
      `char_length("body") BETWEEN 1 AND ${JOURNAL_BODY_MAX_LENGTH}`,
    );
  });
});
