import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { accountFormSchema, PAYMENT_DAY_MAX } from "./accounts";
import type { Debt } from "./debts";
import { EMERGENCY_MONTHS, GOAL_KINDS, goalFormSchema } from "./goals";
import {
  cashEffect,
  cashFlowCheck,
  moneyBasis,
  monthlyStartFor,
  nextDueDay,
  planMoney,
  safetyTargets,
} from "./money-plan";
import type { AccountTypes, UpcomingItem } from "./rules";

const debt = (
  id: string,
  balanceCents: number,
  rateBp: number,
  minimumCents: number,
): Debt => ({ id, name: id, balanceCents, rateBp, minimumCents });

describe("moneyBasis", () => {
  const base = {
    expectedIncomeCents: 400_000,
    averageIncomeCents: 380_000,
    plannedNeedsCents: 180_000,
    plannedWantsCents: 50_000,
    averageNeedsCents: 170_000,
    averageWantsCents: 70_000,
    minimumsCents: 20_000,
  };

  it("prend les revenus du mois, et le plus élevé du plan et de la moyenne pour chaque groupe", () => {
    expect(moneyBasis(base)).toEqual({
      incomeCents: 400_000,
      spendingCents: 250_000,
      minimumsCents: 20_000,
      essentialsCents: 200_000,
      surplusCents: 130_000,
    });
  });

  it("sans revenus ce mois-ci, prend la moyenne des derniers mois", () => {
    expect(moneyBasis({ ...base, expectedIncomeCents: 0 }).incomeCents).toBe(
      380_000,
    );
  });

  it("un surplus négatif dit ce qui manque", () => {
    expect(
      moneyBasis({ ...base, expectedIncomeCents: 200_000 }).surplusCents,
    ).toBe(-70_000);
  });
});

describe("safetyTargets", () => {
  it("un mois pour le coussin, six pour le fonds, à la centaine au-dessus", () => {
    expect(EMERGENCY_MONTHS).toBe(6);
    expect(safetyTargets(212_345)).toEqual({
      cushionCents: 220_000,
      fundCents: 1_280_000,
    });
  });
});

describe("planMoney", () => {
  it("sans surplus, il n'y a pas de plan", () => {
    expect(
      planMoney({
        surplusCents: 0,
        debts: [],
        savedCents: 0,
        cushionCents: 200_000,
        fundCents: 1_200_000,
      }),
    ).toBeNull();
  });

  it("sans dette : le coussin, puis le fonds, puis les placements", () => {
    const plan = planMoney({
      surplusCents: 100_000,
      debts: [],
      savedCents: 0,
      cushionCents: 200_000,
      fundCents: 1_200_000,
    });
    expect(plan?.step).toBe("cushion");
    expect(plan?.thisMonth).toEqual([
      { step: "cushion", cents: 100_000, debtId: null },
    ]);
    expect(plan?.cushionMonth).toBe(2);
    expect(plan?.debtsMonth).toBe(0);
    expect(plan?.fundMonth).toBe(12);
    expect(plan?.investMonth).toBe(13);
    expect(plan?.investCents).toBe(100_000);
  });

  it("le coussin d'abord, puis la dette au taux le plus élevé, et ses minimums passent à la suivante", () => {
    const plan = planMoney({
      surplusCents: 50_000,
      debts: [
        debt("auto", 400_000, 699, 20_000),
        debt("visa", 150_000, 1999, 5_000),
      ],
      savedCents: 30_000,
      cushionCents: 50_000,
      fundCents: 300_000,
    });
    expect(plan?.step).toBe("cushion");
    // Ce mois-ci : 20 000 au coussin, le reste à la Visa (19,99 %)
    expect(plan?.thisMonth).toEqual([
      { step: "cushion", cents: 20_000, debtId: null },
      { step: "debts", cents: 30_000, debtId: "visa" },
    ]);
    expect(plan?.cushionMonth).toBe(1);
    expect(plan?.order.map((entry) => entry.id)).toEqual(["visa", "auto"]);
    expect(plan?.debtsMonth).toBe(plan?.order.at(-1)?.month);
    // Une fois tout payé : le surplus et tous les minimums
    expect(plan?.investCents).toBe(75_000);
    expect(plan?.fundMonth).not.toBeNull();
    expect(plan!.fundMonth!).toBeGreaterThan(plan!.debtsMonth!);
  });

  it("avec le coussin déjà fait, tout le surplus va aux dettes", () => {
    const plan = planMoney({
      surplusCents: 40_000,
      debts: [debt("visa", 100_000, 1999, 5_000)],
      savedCents: 60_000,
      cushionCents: 50_000,
      fundCents: 300_000,
    });
    expect(plan?.step).toBe("debts");
    expect(plan?.cushionMonth).toBe(0);
    expect(plan?.thisMonth).toEqual([
      { step: "debts", cents: 40_000, debtId: "visa" },
    ]);
  });

  it("tout est fait : le surplus va aux placements dès ce mois-ci", () => {
    const plan = planMoney({
      surplusCents: 80_000,
      debts: [],
      savedCents: 1_500_000,
      cushionCents: 200_000,
      fundCents: 1_200_000,
    });
    expect(plan?.step).toBe("invest");
    expect(plan?.thisMonth).toEqual([
      { step: "invest", cents: 80_000, debtId: null },
    ]);
    expect(plan?.investMonth).toBe(1);
  });

  it("une dette que le surplus ne fait jamais baisser ne finit pas", () => {
    const plan = planMoney({
      surplusCents: 100,
      debts: [debt("prêt", 100_000_000, 3000, 1_000)],
      savedCents: 0,
      cushionCents: 1_000,
      fundCents: 6_000,
    });
    expect(plan?.debtsMonth).toBeNull();
    expect(plan?.fundMonth).toBeNull();
    expect(plan?.investMonth).toBeNull();
  });
});

describe("le jour du paiement", () => {
  it("un 31 tombe le 30 d'un mois court", () => {
    expect(nextDueDay("2026-11-10", 31)).toBe("2026-11-30");
    expect(nextDueDay("2026-11-10", 5)).toBe("2026-12-05");
    expect(nextDueDay("2026-11-10", 10)).toBe("2026-11-10");
  });

  it("un paiement fixe commence un jour qui tombe vraiment à cette date", () => {
    expect(monthlyStartFor("2026-11-10", 31)).toBe("2026-12-31");
    expect(monthlyStartFor("2026-11-10", 15)).toBe("2026-11-15");
    expect(monthlyStartFor("2026-11-10", 3)).toBe("2026-12-03");
  });
});

describe("cashEffect et cashFlowCheck", () => {
  const types: AccountTypes = new Map([
    ["cheques", "chequing"],
    ["epargne", "savings"],
    ["visa", "credit"],
    ["auto", "loan"],
  ]);
  const item = (patch: Partial<UpcomingItem>): UpcomingItem => ({
    kind: "expense",
    category: "housing",
    amountCents: 1_000,
    accountId: null,
    toAccountId: null,
    recurringId: "r",
    label: "Loyer",
    day: "2026-11-15",
    frequency: "monthly",
    ...patch,
  });

  it("ce qui entre et sort des comptes de tous les jours", () => {
    expect(
      cashEffect(item({ kind: "income", accountId: "cheques" }), types),
    ).toBe(1_000);
    expect(
      cashEffect(item({ kind: "income", accountId: "epargne" }), types),
    ).toBe(0);
    expect(cashEffect(item({ accountId: "visa" }), types)).toBe(0);
    expect(cashEffect(item({}), types)).toBe(-1_000);
    expect(
      cashEffect(
        item({ kind: "transfer", accountId: "cheques", toAccountId: "auto" }),
        types,
      ),
    ).toBe(-1_000);
    expect(
      cashEffect(
        item({
          kind: "transfer",
          accountId: "epargne",
          toAccountId: "cheques",
        }),
        types,
      ),
    ).toBe(1_000);
    expect(
      cashEffect(
        item({
          kind: "transfer",
          accountId: "cheques",
          toAccountId: "cheques",
        }),
        types,
      ),
    ).toBe(0);
  });

  it("trouve le premier jour où il manquerait de l'argent ; le même jour, la paie passe d'abord", () => {
    const check = cashFlowCheck(50_000, [
      { day: "2026-11-15", cents: -120_000, label: "Loyer" },
      { day: "2026-11-20", cents: 200_000, label: "Paie" },
      { day: "2026-11-01", cents: -10_000, label: "Cellulaire" },
    ]);
    expect(check.shortfall).toEqual({
      day: "2026-11-15",
      cents: 80_000,
      label: "Loyer",
    });
    expect(check.lowestCents).toBe(-80_000);
    expect(
      cashFlowCheck(0, [
        { day: "2026-11-15", cents: -1_000, label: "Loyer" },
        { day: "2026-11-15", cents: 5_000, label: "Paie" },
      ]).shortfall,
    ).toBeNull();
  });
});

describe("formulaires", () => {
  const debtForm = {
    name: "Visa",
    type: "credit",
    balance: "1 500",
    date: "2026-11-01",
    rate: "19,99",
    minimum: "50",
  };

  it("le jour du paiement d'une dette va de 1 à 31", () => {
    expect(
      accountFormSchema.parse({ ...debtForm, paymentDay: "15" }),
    ).toMatchObject({ paymentDay: 15, minimumCents: 5_000, rateBp: 1999 });
    expect(accountFormSchema.parse(debtForm).paymentDay).toBeNull();
    const wrong = accountFormSchema.safeParse({
      ...debtForm,
      paymentDay: "32",
    });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues[0]?.message).toBe("dayInvalid");
    // Un compte qui n'est pas une dette n'en garde pas
    expect(
      accountFormSchema.parse({
        ...debtForm,
        type: "chequing",
        paymentDay: "15",
      }).paymentDay,
    ).toBeNull();
  });

  it("le fonds d'urgence se marque à sa création", () => {
    const goal = { name: "Fonds d’urgence", target: "12 000" };
    expect(goalFormSchema.parse({ ...goal, emergency: "1" }).kind).toBe(
      "emergency",
    );
    expect(goalFormSchema.parse(goal).kind).toBeNull();
  });
});

describe("la migration du plan d'argent", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261127120000_budget_debt_plan/migration.sql",
    ),
    "utf8",
  );

  it("garde les mêmes limites que les règles", () => {
    expect(sql).toContain(`"payment_day" BETWEEN 1 AND ${PAYMENT_DAY_MAX}`);
    expect(sql).toContain(
      `"kind" IN (${GOAL_KINDS.map((kind) => `'${kind}'`).join(", ")})`,
    );
    expect(sql).toContain(`WHERE "kind" = 'emergency'`);
  });
});
