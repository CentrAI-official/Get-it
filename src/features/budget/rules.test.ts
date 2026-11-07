import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES, RATE_MAX_BP } from "./accounts";
import { BUDGET_CATEGORIES, BUDGET_GROUPS } from "./categories";
import { GOAL_NAME_MAX } from "./goals";
import { ACCOUNT_NAME_MAX } from "./accounts";
import {
  BUDGET_AMOUNT_MAX_CENTS,
  BUDGET_FREQUENCIES,
  BALANCE_MAX_CENTS,
  budgetEffect,
  dueOccurrences,
  ENTRY_KINDS,
  parseSignedAmount,
  upcomingIn,
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
      accountId: null,
      toAccountId: null,
      goalId: null,
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
      accountId: null,
      toAccountId: null,
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

describe("transactions", () => {
  const a = "0190f5b2-1d3e-7c4a-8b6f-111111111111";
  const b = "0190f5b2-1d3e-7c4a-8b6f-222222222222";

  it("un virement va d'un compte à un autre", () => {
    const base = { amount: "50", date: "2026-11-04", kind: "transfer" };
    expect(
      entryFormSchema.parse({ ...base, accountId: a, toAccountId: b }),
    ).toMatchObject({ kind: "transfer", category: null, toAccountId: b });
    const same = entryFormSchema.safeParse({
      ...base,
      accountId: a,
      toAccountId: a,
    });
    expect(!same.success && entryFieldErrors(same.error)).toEqual({
      toAccountId: "sameAccount",
    });
    const missing = entryFormSchema.safeParse(base);
    expect(!missing.success && entryFieldErrors(missing.error)).toEqual({
      accountId: "accountRequired",
      toAccountId: "accountRequired",
    });
  });

  it("une catégorie personnelle est un uuid ; un remboursement en demande une", () => {
    expect(
      entryFormSchema.parse({
        kind: "refund",
        amount: "12",
        category: a,
        date: "2026-11-04",
      }),
    ).toMatchObject({ kind: "refund", category: a });
    expect(
      entryFormSchema.safeParse({
        kind: "expense",
        amount: "12",
        category: "pas-une-categorie",
        date: "2026-11-04",
      }).success,
    ).toBe(false);
  });

  it("un montant signé, d'un relevé ou d'un solde", () => {
    expect(parseSignedAmount("-12,50")).toBe(-1250);
    expect(parseSignedAmount("(12.50)")).toBe(-1250);
    expect(parseSignedAmount("12.50-")).toBe(-1250);
    expect(parseSignedAmount("1 250,00 $")).toBe(125000);
    expect(parseSignedAmount("+3")).toBe(300);
    expect(parseSignedAmount("0")).toBe(0);
    expect(parseSignedAmount("abc")).toBeNull();
    expect(parseSignedAmount(String(BALANCE_MAX_CENTS / 100 + 1))).toBeNull();
  });

  it("l'épargne n'est pas une dépense, payer sa carte ne compte pas deux fois", () => {
    const types = new Map([
      [a, "chequing" as const],
      [b, "savings" as const],
      ["card", "credit" as const],
      ["loan", "loan" as const],
    ]);
    const move = (kind: (typeof ENTRY_KINDS)[number], extra = {}) => ({
      kind,
      category: null,
      amountCents: 5000,
      accountId: a,
      toAccountId: null,
      ...extra,
    });
    expect(budgetEffect(move("income"), types).income).toBe(5000);
    expect(
      budgetEffect(move("expense", { category: "groceries" }), types),
    ).toMatchObject({ spent: 5000, category: "groceries" });
    expect(
      budgetEffect(move("refund", { category: "groceries" }), types).spent,
    ).toBe(-5000);
    expect(
      budgetEffect(move("expense", { category: "savings" }), types),
    ).toMatchObject({ spent: 0, saved: 5000 });
    expect(
      budgetEffect(move("transfer", { toAccountId: b }), types),
    ).toMatchObject({ saved: 5000, spent: 0 });
    expect(
      budgetEffect(move("transfer", { accountId: b, toAccountId: a }), types)
        .saved,
    ).toBe(-5000);
    expect(
      budgetEffect(move("transfer", { toAccountId: "card" }), types),
    ).toMatchObject({ saved: 0, spent: 0 });
    expect(
      budgetEffect(move("transfer", { toAccountId: "loan" }), types),
    ).toMatchObject({ spent: 5000, category: "debt" });
    expect(budgetEffect(move("adjustment"), types).income).toBe(0);
  });
});

describe("montants fixes inscrits", () => {
  const rent = {
    frequency: "monthly" as const,
    startsOn: "2026-09-01",
    endsOn: null,
    postedThrough: null,
  };

  it("inscrit les paiements passés, puis seulement les nouveaux", () => {
    const first = dueOccurrences(rent, "2026-11-04", 100);
    expect(first).toEqual({
      days: ["2026-09-01", "2026-10-01", "2026-11-01"],
      postedThrough: "2026-11-04",
    });
    expect(
      dueOccurrences(
        { ...rent, postedThrough: "2026-11-04" },
        "2026-11-30",
        100,
      ).days,
    ).toEqual([]);
    expect(
      dueOccurrences(
        { ...rent, postedThrough: "2026-11-04" },
        "2026-12-01",
        100,
      ).days,
    ).toEqual(["2026-12-01"]);
  });

  it("pas plus de 13 mois en arrière, et le reste à la prochaine fois", () => {
    const old = { ...rent, startsOn: "2020-01-01" };
    expect(dueOccurrences(old, "2026-11-04", 100).days[0]).toBe("2025-10-01");
    const daily = { ...rent, frequency: "daily" as const };
    const part = dueOccurrences(daily, "2026-11-04", 10);
    expect(part.days).toHaveLength(10);
    expect(part.postedThrough).toBe("2026-09-10");
  });

  it("ce qui s'en vient : seulement après aujourd'hui, par date", () => {
    const rules = [
      {
        ...rent,
        id: "loyer",
        kind: "expense" as const,
        label: "Loyer",
        category: "housing",
        amountCents: 120000,
        accountId: null,
        toAccountId: null,
      },
      {
        ...rent,
        id: "paie",
        kind: "income" as const,
        label: "Paie",
        category: null,
        amountCents: 150000,
        frequency: "biweekly" as const,
        startsOn: "2026-10-30",
        accountId: null,
        toAccountId: null,
      },
    ];
    expect(
      upcomingIn(rules, "2026-11-01", "2026-11-30", "2026-11-04").map(
        (item) => `${item.recurringId} ${item.day}`,
      ),
    ).toEqual(["paie 2026-11-13", "paie 2026-11-27"]);
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
  const types = new Map();
  const entry = (
    kind: "income" | "expense",
    cents: number,
    occurredOn: string,
    category: string | null = null,
    recurringId: string | null = null,
  ) => ({
    kind,
    category,
    amountCents: cents,
    accountId: null,
    toAccountId: null,
    occurredOn,
    recurringId,
  });
  const entries = [
    entry("income", 150000, "2026-11-13", null, "paie"),
    entry("expense", 120000, "2026-11-01", "housing", "loyer"),
    entry("expense", 15000, "2026-11-03", "groceries"),
    entry("expense", 30000, "2026-11-05", "savings"),
  ];
  const upcoming = [
    {
      kind: "income" as const,
      category: null,
      amountCents: 150000,
      accountId: null,
      toAccountId: null,
      recurringId: "paie",
      label: "Paie",
      day: "2026-11-27",
      frequency: "biweekly" as const,
    },
    {
      kind: "expense" as const,
      category: "subscriptions",
      amountCents: 5000,
      accountId: null,
      toAccountId: null,
      recurringId: "tel",
      label: "Téléphone",
      day: "2026-11-20",
      frequency: "monthly" as const,
    },
  ];

  it("ce qui entre, sort, est gardé et reste", () => {
    const summary = summarizeBudget({
      entries,
      upcoming,
      types,
      start: "2026-11-01",
      end: "2026-11-30",
      today: "2026-11-15",
    });
    expect(summary.incomeCents).toBe(150000);
    expect(summary.upcomingIncomeCents).toBe(150000);
    expect(summary.spentCents).toBe(135000);
    expect(summary.fixedSpentCents).toBe(120000);
    expect(summary.upcomingCents).toBe(5000);
    // L'épargne n'est pas une dépense
    expect(summary.savedCents).toBe(30000);
    expect(summary.remainingCents).toBe(300000 - 135000 - 5000 - 30000);
    expect(summary.categories.map((line) => line.category)).toEqual([
      "housing",
      "groceries",
      "subscriptions",
    ]);
    expect(summary.daysLeft).toBe(16);
    expect(summary.perDayCents).toBe(Math.floor(130000 / 16));
  });

  it("l'épargne prévue pas encore faite n'est pas à dépenser", () => {
    const summary = summarizeBudget({
      entries,
      upcoming,
      types,
      start: "2026-11-01",
      end: "2026-11-30",
      today: "2026-11-15",
      reserveCents: 20000,
    });
    expect(summary.remainingCents).toBe(110000);
  });

  it("une période passée n'a plus de jours, un dépassement est négatif", () => {
    const summary = summarizeBudget({
      entries: [entry("expense", 400000, "2026-11-03", "groceries")],
      upcoming: [],
      types,
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
  const read = (name: string) =>
    readFileSync(
      join(process.cwd(), `prisma/migrations/${name}/migration.sql`),
      "utf8",
    );
  const sql = read("20261114120000_budget");
  const complete = read("20261118120000_budget_complete");
  const list = (values: readonly string[]) =>
    values.map((value) => `'${value}'`).join(", ");

  it("le budget complet garde les mêmes listes et limites que les règles", () => {
    expect(complete).toContain(`"category" IN (${list(BUDGET_CATEGORIES)})`);
    expect(complete).toContain(`"kind" IN (${list(ENTRY_KINDS)})`);
    expect(complete).toContain(`"type" IN (${list(ACCOUNT_TYPES)})`);
    expect(complete).toContain(`"group" IN (${list(BUDGET_GROUPS)})`);
    expect(complete).toContain(
      `char_length("name") BETWEEN 1 AND ${ACCOUNT_NAME_MAX}`,
    );
    expect(complete).toContain(
      `char_length("name") BETWEEN 1 AND ${GOAL_NAME_MAX}`,
    );
    expect(complete).toContain(`"rate_bp" BETWEEN 0 AND ${RATE_MAX_BP}`);
    expect(complete).toContain(
      `BETWEEN -${BALANCE_MAX_CENTS} AND ${BALANCE_MAX_CENTS}`,
    );
    for (const table of [
      "budget_accounts",
      "budget_goals",
      "budget_categories",
      "budget_plans",
    ]) {
      expect(complete).toContain(`"${table}" ENABLE ROW LEVEL SECURITY`);
    }
  });

  it("garde les mêmes listes et limites que les règles", () => {
    expect(sql).toContain(`"frequency" IN (${list(BUDGET_FREQUENCIES)})`);
    expect(sql).toContain(`BETWEEN 1 AND ${BUDGET_LABEL_MAX}`);
    expect(sql).toContain(`BETWEEN 1 AND ${BUDGET_NOTE_MAX}`);
    expect(sql).toContain(`BETWEEN 1 AND ${BUDGET_AMOUNT_MAX_CENTS}`);
    expect(sql).toContain('"budget_recurring" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('"budget_entries" ENABLE ROW LEVEL SECURITY');
  });
});
