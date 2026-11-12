import { describe, expect, it } from "vitest";
import type { FixedPayment } from "./checklist";
import {
  assignRows,
  dueWhen,
  envelopesOf,
  fixedSummary,
  unassignedCents,
} from "./envelopes";
import type { MonthPlan, PlanLine } from "./plan";

function line(key: string, values: Partial<PlanLine> = {}): PlanLine {
  const plannedCents = values.plannedCents ?? 0;
  const spentCents = values.spentCents ?? 0;
  const upcomingCents = values.upcomingCents ?? 0;
  const carryCents = values.carryCents ?? 0;
  const fixedCents = values.fixedCents ?? 0;
  return {
    key,
    group: key === "savings" || key === "debt" ? "savings" : "wants",
    plannedCents,
    explicit: true,
    spentCents,
    upcomingCents,
    fixedCents,
    carryCents,
    availableCents: plannedCents + carryCents - spentCents - upcomingCents,
    rollover: false,
    variable: fixedCents === 0 && key !== "savings",
    ...values,
  };
}

function plan(lines: PlanLine[], extra: Partial<MonthPlan> = {}): MonthPlan {
  return {
    groups: [
      {
        group: "wants",
        lines,
        plannedCents: 0,
        usedCents: 0,
      },
    ],
    plannedCents: 0,
    expectedIncomeCents: 390_000,
    toAssignCents: 0,
    minimumsReserveCents: 0,
    minimumsCents: 0,
    reserveCents: 0,
    ...extra,
  };
}

// Le mercredi 11 novembre : un peu plus du tiers du mois est passé
const ELAPSED = 11 / 30;

describe("envelopesOf", () => {
  it("montre ce qui reste dans chaque enveloppe, et la part qui reste", () => {
    const { envelopes } = envelopesOf(
      plan([line("groceries", { plannedCents: 60_000, spentCents: 21_400 })]),
      ELAPSED,
    );
    expect(envelopes).toEqual([
      {
        key: "groceries",
        budgetCents: 60_000,
        leftCents: 38_600,
        spentCents: 21_400,
        share: 0.6433333333333333,
        state: "ok",
      },
    ]);
  });

  it("signale l'enveloppe qui se vide plus vite que le mois", () => {
    const { envelopes } = envelopesOf(
      plan([line("restaurants", { plannedCents: 15_000, spentCents: 9_600 })]),
      ELAPSED,
    );
    expect(envelopes[0]?.state).toBe("fast");
  });

  it("une enveloppe pas encore touchée, dépassée ou sans montant prévu", () => {
    const { envelopes } = envelopesOf(
      plan([
        line("shopping", { plannedCents: 10_000 }),
        line("leisure", { plannedCents: 10_000, spentCents: 12_000 }),
        line("gifts", { spentCents: 4_500 }),
      ]),
      ELAPSED,
    );
    expect(envelopes.map((envelope) => envelope.state)).toEqual([
      "untouched",
      "over",
      "unplanned",
    ]);
    expect(envelopes[1]).toMatchObject({ leftCents: -2_000, share: 0 });
  });

  it("le report s'ajoute au montant prévu", () => {
    const { envelopes } = envelopesOf(
      plan([
        line("leisure", {
          plannedCents: 10_000,
          carryCents: 4_000,
          spentCents: 7_000,
        }),
      ]),
      ELAPSED,
    );
    expect(envelopes[0]).toMatchObject({
      budgetCents: 14_000,
      leftCents: 7_000,
      share: 0.5,
    });
  });

  it("les paiements fixes n'ont pas d'enveloppe, sauf s'ils dépassent", () => {
    const fixed = { fixedCents: 120_000, plannedCents: 120_000 };
    expect(
      envelopesOf(plan([line("housing", fixed)]), ELAPSED).envelopes,
    ).toEqual([]);
    const over = envelopesOf(
      plan([line("housing", { ...fixed, spentCents: 125_000 })]),
      ELAPSED,
    );
    expect(over.envelopes[0]?.state).toBe("over");
  });

  it("l'épargne est à part : elle se remplit", () => {
    const result = envelopesOf(
      plan([line("savings", { plannedCents: 40_000, spentCents: 15_000 })]),
      ELAPSED,
    );
    expect(result.envelopes).toEqual([]);
    expect(result.savings).toEqual({
      budgetCents: 40_000,
      savedCents: 15_000,
      leftCents: 25_000,
      share: 0.375,
      reached: false,
    });
    expect(
      envelopesOf(
        plan([line("savings", { plannedCents: 40_000, spentCents: 40_000 })]),
        ELAPSED,
      ).savings?.reached,
    ).toBe(true);
  });
});

describe("dueWhen", () => {
  const today = "2026-11-11";
  it("en retard, aujourd'hui, demain, cette semaine ou plus tard", () => {
    expect(dueWhen("2026-11-10", today)).toEqual({ kind: "late" });
    expect(dueWhen(today, today)).toEqual({ kind: "today" });
    expect(dueWhen("2026-11-12", today)).toEqual({ kind: "tomorrow" });
    expect(dueWhen("2026-11-15", today)).toEqual({
      kind: "weekday",
      day: "2026-11-15",
    });
    expect(dueWhen("2026-11-25", today)).toEqual({
      kind: "date",
      day: "2026-11-25",
    });
  });
});

function payment(
  label: string,
  day: string,
  cents: number,
  state: FixedPayment["state"],
): FixedPayment {
  return {
    recurringId: label,
    kind: "expense",
    label,
    day,
    plannedCents: cents,
    paidCents: state === "paid" ? cents : null,
    state,
  };
}

describe("fixedSummary", () => {
  it("ce qui reste à payer, combien sont payés et les deux prochains", () => {
    const summary = fixedSummary(
      [
        payment("Loyer", "2026-11-01", 120_000, "paid"),
        payment("Hydro", "2026-11-05", 8_200, "paid"),
        payment("Téléphone", "2026-11-20", 6_500, "upcoming"),
        payment("Internet", "2026-11-12", 8_000, "upcoming"),
        payment("Visa", "2026-11-15", 12_000, "upcoming"),
        payment("Gym", "2026-11-03", 4_000, "skipped"),
      ],
      [payment("Netflix", "2026-10-28", 1_800, "due")],
    );
    expect(summary).toEqual({
      leftCents: 26_500,
      paid: 2,
      count: 5,
      open: 3,
      next: [
        { label: "Internet", day: "2026-11-12" },
        { label: "Visa", day: "2026-11-15" },
      ],
      late: 1,
    });
  });
});

describe("Répartir", () => {
  const monthPlan = plan([
    line("housing", { plannedCents: 120_000, fixedCents: 120_000 }),
    line("groceries", { plannedCents: 60_000 }),
    line("savings", { plannedCents: 40_000 }),
  ]);

  it("les enveloppes se changent, les paiements fixes sont à part", () => {
    expect(assignRows(monthPlan, ELAPSED)).toEqual({
      rows: [
        { key: "groceries", plannedCents: 60_000 },
        { key: "savings", plannedCents: 40_000 },
      ],
      fixed: [{ key: "housing", cents: 120_000 }],
    });
  });

  it("ce qui reste sans enveloppe baisse pendant qu'on tape", () => {
    const fixed = [{ key: "housing", cents: 120_000 }];
    const amounts = new Map([
      ["groceries", 60_000],
      ["savings", 40_000],
    ]);
    expect(
      unassignedCents({
        incomeCents: 390_000,
        minimumsCents: 0,
        fixed,
        amounts,
      }),
    ).toBe(170_000);
    // Les minimums des dettes que l'enveloppe Dettes ne prévoit pas encore
    expect(
      unassignedCents({
        incomeCents: 390_000,
        minimumsCents: 12_000,
        fixed,
        amounts,
      }),
    ).toBe(158_000);
    expect(
      unassignedCents({
        incomeCents: 390_000,
        minimumsCents: 12_000,
        fixed,
        amounts: new Map([...amounts, ["debt", 20_000]]),
      }),
    ).toBe(150_000);
  });
});
