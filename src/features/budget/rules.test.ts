import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUDGET_AMOUNT_MAX_CENTS,
  BUDGET_CATEGORIES,
  BUDGET_FREQUENCIES,
  BUDGET_LABEL_MAX,
  BUDGET_NOTE_MAX,
  entryFieldErrors,
  entryFormSchema,
  monthlyEquivalent,
  nextOccurrence,
  occurrencesIn,
  parseAmount,
  periodOf,
  recurringFieldErrors,
  recurringFormSchema,
  shiftPeriod,
  summarizeBudget,
  type BudgetRecurringRow,
} from "./rules";

describe("parseAmount", () => {
  it("lit les montants écrits en français et en anglais", () => {
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("12,5")).toBe(1250);
    expect(parseAmount(" 1 250,50 $")).toBe(125050);
    expect(parseAmount("1 250,50")).toBe(125050);
    expect(parseAmount("1,250.50")).toBe(125050);
    expect(parseAmount("1.250,50")).toBe(125050);
  });

  it("refuse zéro, un montant négatif, trois décimales ou trop grand", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1,234")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(String(BUDGET_AMOUNT_MAX_CENTS / 100))).toBe(
      BUDGET_AMOUNT_MAX_CENTS,
    );
    expect(parseAmount(String(BUDGET_AMOUNT_MAX_CENTS / 100 + 1))).toBeNull();
  });
});

describe("formulaires", () => {
  it("une dépense demande une catégorie, un revenu n'en garde pas", () => {
    expect(
      entryFormSchema.parse({
        kind: "expense",
        amount: "42,10",
        category: "groceries",
        note: "  Épicerie de la semaine ",
        date: "2026-11-01",
      }),
    ).toEqual({
      kind: "expense",
      amountCents: 4210,
      category: "groceries",
      note: "Épicerie de la semaine",
      occurredOn: "2026-11-01",
    });
    expect(
      entryFormSchema.parse({
        kind: "income",
        amount: "200",
        category: "groceries",
        note: "",
        date: "2026-11-01",
      }),
    ).toMatchObject({ category: null, note: null });
    const missing = entryFormSchema.safeParse({
      kind: "expense",
      amount: "abc",
      category: "",
      date: "2026-13-01",
      note: "x".repeat(BUDGET_NOTE_MAX + 1),
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(entryFieldErrors(missing.error)).toMatchObject({
        amount: "amountInvalid",
        date: "dateInvalid",
        note: "noteTooLong",
      });
    }
    const noCategory = entryFormSchema.safeParse({
      kind: "expense",
      amount: "5",
      category: "",
      date: "2026-11-01",
    });
    expect(!noCategory.success && entryFieldErrors(noCategory.error)).toEqual({
      category: "categoryRequired",
    });
  });

  it("un revenu ou une dépense fixe : titre, fréquence et fin après le début", () => {
    const valid = {
      kind: "income",
      label: "Salaire",
      amount: "1 250",
      frequency: "biweekly",
      startsOn: "2026-10-30",
      endsOn: "",
    };
    expect(recurringFormSchema.parse(valid)).toEqual({
      kind: "income",
      label: "Salaire",
      amountCents: 125000,
      category: null,
      frequency: "biweekly",
      startsOn: "2026-10-30",
      endsOn: null,
    });
    const long = recurringFormSchema.safeParse({
      ...valid,
      label: "x".repeat(BUDGET_LABEL_MAX + 1),
    });
    expect(!long.success && recurringFieldErrors(long.error)).toEqual({
      label: "labelTooLong",
    });
    const before = recurringFormSchema.safeParse({
      ...valid,
      kind: "expense",
      category: "housing",
      endsOn: "2026-10-01",
    });
    expect(!before.success && recurringFieldErrors(before.error)).toEqual({
      endsOn: "endBeforeStart",
    });
  });
});

describe("périodes", () => {
  it("jour, semaine du lundi au dimanche, mois", () => {
    expect(periodOf("day", "2026-11-04")).toEqual({
      start: "2026-11-04",
      end: "2026-11-04",
    });
    expect(periodOf("week", "2026-11-01")).toEqual({
      start: "2026-10-26",
      end: "2026-11-01",
    });
    expect(periodOf("month", "2028-02-10")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });

  it("passe à la période précédente ou suivante", () => {
    expect(shiftPeriod("month", "2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftPeriod("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftPeriod("week", "2026-11-04", -1)).toBe("2026-10-26");
    expect(shiftPeriod("day", "2026-11-30", 1)).toBe("2026-12-01");
  });
});

describe("revenus et dépenses fixes", () => {
  const rule = (
    frequency: BudgetRecurringRow["frequency"],
    startsOn: string,
    endsOn: string | null = null,
  ) => ({ frequency, startsOn, endsOn });

  it("chaque semaine et aux deux semaines, à partir du premier jour", () => {
    expect(
      occurrencesIn(rule("biweekly", "2026-10-02"), "2026-11-01", "2026-11-30"),
    ).toEqual(["2026-11-13", "2026-11-27"]);
    expect(
      occurrencesIn(rule("weekly", "2026-11-10"), "2026-11-01", "2026-11-30"),
    ).toEqual(["2026-11-10", "2026-11-17", "2026-11-24"]);
    expect(
      occurrencesIn(
        rule("daily", "2026-11-01", "2026-11-03"),
        "2026-10-01",
        "2026-11-30",
      ),
    ).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });

  it("chaque mois le même jour, ou le dernier jour d'un mois court", () => {
    const rent = rule("monthly", "2026-08-31");
    expect(occurrencesIn(rent, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-30",
    ]);
    expect(occurrencesIn(rent, "2027-02-01", "2027-02-28")).toEqual([
      "2027-02-28",
    ]);
    expect(occurrencesIn(rent, "2026-06-01", "2026-06-30")).toEqual([]);
    expect(
      occurrencesIn(rule("yearly", "2024-02-29"), "2026-01-01", "2026-12-31"),
    ).toEqual(["2026-02-28"]);
  });

  it("prochaine date et équivalent par mois", () => {
    expect(nextOccurrence(rule("monthly", "2026-01-15"), "2026-11-16")).toBe(
      "2026-12-15",
    );
    expect(
      nextOccurrence(rule("monthly", "2026-01-15", "2026-11-01"), "2026-11-16"),
    ).toBeNull();
    expect(
      monthlyEquivalent({ frequency: "weekly", amountCents: 125000 }),
    ).toBe(541667);
    expect(monthlyEquivalent({ frequency: "yearly", amountCents: 1200 })).toBe(
      100,
    );
  });
});

describe("summarizeBudget", () => {
  const recurring: BudgetRecurringRow[] = [
    {
      id: "salaire",
      kind: "income",
      label: "Salaire",
      category: null,
      amountCents: 150000,
      frequency: "biweekly",
      startsOn: "2026-10-02",
      endsOn: null,
    },
    {
      id: "loyer",
      kind: "expense",
      label: "Loyer",
      category: "housing",
      amountCents: 120000,
      frequency: "monthly",
      startsOn: "2026-01-01",
      endsOn: null,
    },
    {
      id: "telephone",
      kind: "expense",
      label: "Téléphone",
      category: "subscriptions",
      amountCents: 5000,
      frequency: "monthly",
      startsOn: "2026-01-20",
      endsOn: null,
    },
  ];
  const entries = [
    {
      id: "a",
      kind: "expense" as const,
      category: "groceries" as const,
      amountCents: 15000,
      note: null,
      occurredOn: "2026-11-03",
    },
    {
      id: "b",
      kind: "income" as const,
      category: null,
      amountCents: 10000,
      note: "Cadeau",
      occurredOn: "2026-11-05",
    },
  ];

  it("ce qui entre, le prévu, le dépensé et ce qui reste", () => {
    const summary = summarizeBudget({
      entries,
      recurring,
      start: "2026-11-01",
      end: "2026-11-30",
      today: "2026-11-11",
    });
    // Deux paies (13 et 27 novembre) et un cadeau
    expect(summary.incomeCents).toBe(310000);
    expect(summary.fixedCents).toBe(125000);
    expect(summary.spentCents).toBe(15000);
    expect(summary.remainingCents).toBe(170000);
    // Le téléphone du 20 est encore à venir
    expect(summary.upcomingFixedCents).toBe(5000);
    expect(summary.categories.map((entry) => entry.category)).toEqual([
      "housing",
      "groceries",
      "subscriptions",
    ]);
    expect(summary.daysLeft).toBe(20);
    expect(summary.perDayCents).toBe(8500);
  });

  it("une période passée n'a plus de jours, un dépassement est négatif", () => {
    const summary = summarizeBudget({
      entries: [{ ...entries[0]!, amountCents: 400000 }],
      recurring,
      start: "2026-11-01",
      end: "2026-11-30",
      today: "2026-12-05",
    });
    expect(summary.remainingCents).toBeLessThan(0);
    expect(summary.daysLeft).toBe(0);
    expect(summary.perDayCents).toBeNull();
  });
});

describe("migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261114120000_budget/migration.sql",
    ),
    "utf8",
  );
  const list = (values: readonly string[]) =>
    values.map((value) => `'${value}'`).join(", ");

  it("garde les mêmes listes et limites que les règles", () => {
    expect(sql).toContain(`"category" IN (${list(BUDGET_CATEGORIES)})`);
    expect(sql).toContain(`"frequency" IN (${list(BUDGET_FREQUENCIES)})`);
    expect(sql).toContain(`BETWEEN 1 AND ${BUDGET_LABEL_MAX}`);
    expect(sql).toContain(`BETWEEN 1 AND ${BUDGET_NOTE_MAX}`);
    expect(sql).toContain(`BETWEEN 1 AND ${BUDGET_AMOUNT_MAX_CENTS}`);
    expect(sql).toContain('"budget_recurring" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('"budget_entries" ENABLE ROW LEVEL SECURITY');
  });
});
