import { describe, expect, it } from "vitest";
import {
  balanceOf,
  netWorthOf,
  netWorthSeries,
  parseRate,
  accountFormSchema,
} from "./accounts";
import { categoryList, CATEGORY_GROUPS, isCategoryKey } from "./categories";
import { simulatePayoff } from "./debts";
import { parseTransactionFilters } from "./filters";
import { goalProgress } from "./goals";
import {
  csvCell,
  detectDateOrder,
  guessCategory,
  guessMapping,
  importIdentity,
  normalizeDescription,
  parseCsv,
  parseCsvDate,
  readImportRows,
  toCsv,
  withOccurrences,
} from "./import";
import {
  annualToPrepare,
  buildMonthPlan,
  carryFor,
  lineStatus,
  monthElapsed,
  plannedFor,
  rollupMonths,
  suggestPlan,
  type MonthlyRow,
} from "./plan";
import { cashFlow, categoryTrends, groupShares, savingsRate } from "./reports";
import { monthlyIncome } from "./setup";

const NO_TYPES = new Map();
const row = (
  month: string,
  kind: MonthlyRow["kind"],
  category: string | null,
  cents: number,
  fixed = false,
): MonthlyRow => ({
  month,
  kind,
  category,
  accountId: null,
  toAccountId: null,
  fixed,
  cents,
});
const categories = categoryList([]);

describe("catégories", () => {
  it("celles de Get iT, puis les personnelles dans leur groupe", () => {
    const custom = "0190f5b2-1d3e-7c4a-8b6f-333333333333";
    const list = categoryList([
      { key: custom, name: "Gym", group: "needs", icon: "dumbbell" },
      { key: "groceries", name: null, group: null, icon: null },
    ]);
    const needs = list.filter((entry) => entry.group === "needs");
    expect(needs.at(-1)).toMatchObject({ key: custom, name: "Gym" });
    // Un réglage sans nom (le report) n'est pas une catégorie de plus
    expect(list).toHaveLength(Object.keys(CATEGORY_GROUPS).length + 1);
    expect(isCategoryKey(custom)).toBe(true);
    expect(isCategoryKey("housing")).toBe(true);
    expect(isCategoryKey("maison")).toBe(false);
  });
});

describe("plan du mois", () => {
  const rollups = rollupMonths(
    [
      row("2026-10", "expense", "groceries", 55000),
      row("2026-10", "expense", "housing", 120000, true),
      row("2026-11", "income", null, 300000, true),
      row("2026-11", "expense", "housing", 120000, true),
      row("2026-11", "expense", "groceries", 30000),
      row("2026-11", "refund", "groceries", 2000),
      row("2026-11", "expense", "savings", 10000),
    ],
    NO_TYPES,
  );
  const plans = [
    { category: "groceries", month: "2026-10-01", amountCents: 60000 },
    { category: "savings", month: "2026-11-01", amountCents: 50000 },
  ];

  it("un montant vaut jusqu'au prochain changement", () => {
    expect(plannedFor(plans, "groceries", "2026-12-01")).toBe(60000);
    expect(plannedFor(plans, "groceries", "2026-09-01")).toBeNull();
    expect(plannedFor(plans, "restaurants", "2026-11-01")).toBeNull();
  });

  it("chaque catégorie : prévu, sorti, à venir, reste ; le reste à répartir", () => {
    const plan = buildMonthPlan({
      month: "2026-11-01",
      categories,
      plans,
      rollups,
      upcoming: [
        {
          kind: "expense",
          category: "phone",
          amountCents: 6000,
          accountId: null,
          toAccountId: null,
          recurringId: "tel",
          label: "Téléphone",
          day: "2026-11-20",
          frequency: "monthly",
        },
      ],
      rollovers: new Map(),
      types: NO_TYPES,
    });
    const lines = new Map(
      plan.groups
        .flatMap((group) => group.lines)
        .map((line) => [line.key, line]),
    );
    // Sans montant choisi : les paiements fixes
    expect(lines.get("housing")).toMatchObject({
      plannedCents: 120000,
      explicit: false,
      availableCents: 0,
      variable: false,
    });
    expect(lines.get("phone")).toMatchObject({
      plannedCents: 6000,
      upcomingCents: 6000,
      availableCents: 0,
    });
    // Le remboursement réduit ce qui est sorti
    expect(lines.get("groceries")).toMatchObject({
      plannedCents: 60000,
      spentCents: 28000,
      availableCents: 32000,
      variable: true,
    });
    expect(lines.get("savings")).toMatchObject({ spentCents: 10000 });
    expect(plan.expectedIncomeCents).toBe(300000);
    expect(plan.plannedCents).toBe(120000 + 6000 + 60000 + 50000);
    expect(plan.toAssignCents).toBe(300000 - 236000);
    // L'épargne prévue pas encore faite
    expect(plan.reserveCents).toBe(40000);
    expect(plan.groups.map((group) => group.group)).toEqual([
      "needs",
      "savings",
    ]);
  });

  it("le report : ce qui reste s'ajoute, un dépassement retranche", () => {
    const carry = carryFor(
      "groceries",
      "2026-10-01",
      "2026-12-01",
      plans,
      rollups,
    );
    // Octobre : 600 − 550 ; novembre : 600 − 280
    expect(carry).toBe(5000 + 32000);
    expect(
      carryFor("groceries", "2026-11-01", "2026-11-01", plans, rollups),
    ).toBe(0);
  });

  it("l'état d'une catégorie selon le temps écoulé", () => {
    const line = {
      key: "groceries",
      group: "needs" as const,
      plannedCents: 60000,
      explicit: true,
      spentCents: 40000,
      upcomingCents: 0,
      carryCents: 0,
      availableCents: 20000,
      rollover: false,
      variable: true,
    };
    expect(lineStatus(line, 0.5)).toBe("fast");
    expect(lineStatus(line, 0.7)).toBe("ok");
    expect(lineStatus({ ...line, availableCents: -100 }, 0.9)).toBe("over");
    expect(
      lineStatus({ ...line, plannedCents: 0, availableCents: -40000 }, 0.5),
    ).toBe("unplanned");
    // L'épargne ne va jamais « trop vite » : elle atteint ce qui était prévu
    const savings = { ...line, key: "savings", group: "savings" as const };
    expect(lineStatus({ ...savings, spentCents: 10000 }, 0.1)).toBe("ok");
    expect(
      lineStatus(
        { ...savings, spentCents: 70000, availableCents: -10000 },
        0.1,
      ),
    ).toBe("reached");
    expect(monthElapsed("2026-11-01", "2026-11-15")).toBe(0.5);
    expect(monthElapsed("2026-11-01", "2026-12-02")).toBe(1);
    expect(monthElapsed("2026-11-01", "2026-10-30")).toBe(0);
  });

  it("une première répartition 50/30/20, après les paiements fixes", () => {
    const plan = suggestPlan(400000, [
      { group: "needs", cents: 150000 },
      { group: "wants", cents: 2000 },
    ]);
    const amount = (key: string) =>
      plan.find((item) => item.category === key)?.cents;
    expect(amount("groceries")).toBe(30000);
    expect(amount("transport")).toBe(20000);
    expect(amount("savings")).toBe(80000);
    expect(plan.every((item) => item.cents % 500 === 0)).toBe(true);
    // Les fixes prennent trop de place : tout rétrécit pour rester dans les revenus
    const tight = suggestPlan(200000, [{ group: "needs", cents: 180000 }]);
    expect(
      tight.reduce((sum, item) => sum + item.cents, 0),
    ).toBeLessThanOrEqual(20000);
    expect(suggestPlan(100000, [{ group: "needs", cents: 120000 }])).toEqual(
      [],
    );
  });

  it("les dépenses annuelles à préparer chaque mois", () => {
    const insurance = {
      id: "auto",
      kind: "expense" as const,
      label: "Assurance auto",
      category: "insurance",
      amountCents: 120000,
      frequency: "yearly" as const,
      startsOn: "2026-03-15",
      endsOn: null,
      accountId: null,
      toAccountId: null,
      postedThrough: null,
    };
    expect(annualToPrepare([insurance], [], "2026-11-01")).toEqual([
      { rule: insurance, monthlyCents: 10000 },
    ]);
    expect(
      annualToPrepare(
        [insurance],
        [{ category: "insurance", month: "2026-11-01", amountCents: 10000 }],
        "2026-11-01",
      ),
    ).toEqual([]);
  });
});

describe("comptes", () => {
  const accounts = [
    { id: "cheques", openingCents: 100000, openedOn: "2026-09-10" },
    { id: "visa", openingCents: -50000, openedOn: "2026-10-01" },
  ];
  const deltas = [
    { accountId: "cheques", month: "2026-10", cents: -20000 },
    { accountId: "visa", month: "2026-10", cents: 10000 },
    { accountId: "cheques", month: "2026-11", cents: 5000 },
  ];

  it("le solde, la valeur nette et sa courbe", () => {
    expect(balanceOf(accounts[0]!, deltas)).toBe(85000);
    expect(netWorthOf(accounts, deltas)).toEqual({
      assetsCents: 85000,
      debtsCents: 40000,
      netCents: 45000,
    });
    expect(
      netWorthSeries(accounts, deltas, [
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
      ]),
    ).toEqual([
      { month: "2026-09", cents: 100000 },
      { month: "2026-10", cents: 40000 },
      { month: "2026-11", cents: 45000 },
    ]);
  });

  it("une dette se tape en positif ; le taux en pour cent", () => {
    expect(parseRate("19,99")).toBe(1999);
    expect(parseRate("7 %")).toBe(700);
    expect(parseRate("101")).toBeNull();
    expect(
      accountFormSchema.parse({
        name: "Visa",
        type: "credit",
        balance: "1 200",
        date: "2026-11-04",
        rate: "19,99",
        minimum: "50",
      }),
    ).toEqual({
      name: "Visa",
      type: "credit",
      openingCents: -120000,
      openedOn: "2026-11-04",
      rateBp: 1999,
      minimumCents: 5000,
      paymentDay: null,
    });
    // Un compte chèques à découvert reste négatif ; pas de taux hors des dettes
    expect(
      accountFormSchema.parse({
        name: "Chèques",
        type: "chequing",
        balance: "-25",
        date: "2026-11-04",
        rate: "5",
      }),
    ).toMatchObject({ openingCents: -2500, rateBp: null, minimumCents: null });
  });
});

describe("dettes", () => {
  it("une dette : les mois et les intérêts, au cent près", () => {
    const result = simulatePayoff(
      [
        {
          id: "a",
          name: "A",
          balanceCents: 100000,
          rateBp: 1200,
          minimumCents: 10000,
        },
      ],
      0,
      "avalanche",
    );
    expect(result).toMatchObject({
      months: 11,
      interestCents: 5898,
      finished: true,
    });
  });

  it("avalanche : moins d'intérêts ; boule de neige : la petite dette d'abord", () => {
    const debts = [
      {
        id: "carte",
        name: "Carte",
        balanceCents: 300000,
        rateBp: 1999,
        minimumCents: 9000,
      },
      {
        id: "auto",
        name: "Auto",
        balanceCents: 80000,
        rateBp: 600,
        minimumCents: 5000,
      },
    ];
    const avalanche = simulatePayoff(debts, 20000, "avalanche");
    const snowball = simulatePayoff(debts, 20000, "snowball");
    const minimum = simulatePayoff(debts, 0, null);
    expect(avalanche.interestCents).toBeLessThan(snowball.interestCents);
    expect(snowball.order[0]?.id).toBe("auto");
    expect(avalanche.months).toBeLessThan(minimum.months);
    expect(avalanche.interestCents).toBeLessThan(minimum.interestCents);
  });

  it("des paiements qui couvrent à peine les intérêts ne finissent jamais", () => {
    const result = simulatePayoff(
      [
        {
          id: "a",
          name: "A",
          balanceCents: 1000000,
          rateBp: 2400,
          minimumCents: 10000,
        },
      ],
      0,
      "avalanche",
    );
    expect(result.finished).toBe(false);
  });
});

describe("objectifs d'épargne", () => {
  it("le pourcentage, et ce qu'il faut par mois pour arriver à temps", () => {
    const goal = {
      targetCents: 300000,
      targetOn: "2027-04-30",
      startingCents: 50000,
      addedCents: 10000,
    };
    expect(goalProgress(goal, "2026-11-04")).toMatchObject({
      savedCents: 60000,
      percent: 20,
      monthsLeft: 5,
      monthlyCents: 40000,
      done: false,
      late: false,
    });
    expect(
      goalProgress({ ...goal, addedCents: 250000 }, "2026-11-04"),
    ).toMatchObject({
      done: true,
      percent: 100,
      monthlyCents: null,
    });
    expect(goalProgress(goal, "2027-05-02").late).toBe(true);
  });

  it("le revenu du mois le plus court : une paie de plus est un bonus", () => {
    expect(monthlyIncome(150000, "biweekly")).toBe(300000);
    expect(monthlyIncome(100000, "weekly")).toBe(400000);
    expect(monthlyIncome(320000, "monthly")).toBe(320000);
  });
});

describe("import d'un relevé", () => {
  it("lit les guillemets, le point-virgule et la marque d'ordre des octets", () => {
    expect(
      parseCsv(
        '﻿Date;Description;Montant\n2026-11-01;"IGA; Montréal";-42,10\n\n',
      ),
    ).toEqual([
      ["Date", "Description", "Montant"],
      ["2026-11-01", "IGA; Montréal", "-42,10"],
    ]);
    expect(parseCsv('a,"dit ""bonjour""",c\r\nd,e,f')).toEqual([
      ["a", 'dit "bonjour"', "c"],
      ["d", "e", "f"],
    ]);
  });

  it("les dates de chaque banque", () => {
    expect(parseCsvDate("2026/11/04", "ymd")).toBe("2026-11-04");
    expect(parseCsvDate("04/11/2026", "dmy")).toBe("2026-11-04");
    expect(parseCsvDate("11/04/2026", "mdy")).toBe("2026-11-04");
    expect(parseCsvDate("31/02/2026", "dmy")).toBeNull();
    expect(detectDateOrder(["11/04/2026", "11/28/2026"])).toBe("mdy");
    expect(detectDateOrder(["28/11/2026"])).toBe("dmy");
  });

  it("avec entêtes, une seule colonne de montants (Tangerine)", () => {
    const rows = parseCsv(
      "Date,Transaction,Name,Memo,Amount\n11/03/2026,DEBIT,METRO #123,,-58.20\n11/04/2026,CREDIT,PAIE,,1500.00",
    );
    const mapping = guessMapping(rows);
    expect(mapping).toMatchObject({
      hasHeader: true,
      date: 0,
      amount: 4,
      dateOrder: "mdy",
    });
    const read = readImportRows(rows, { ...mapping, description: 2 });
    expect(read.rows).toEqual([
      { date: "2026-11-03", cents: -5820, description: "METRO #123" },
      { date: "2026-11-04", cents: 150000, description: "PAIE" },
    ]);
  });

  it("sans entêtes, sorties et entrées séparées (TD)", () => {
    const rows = parseCsv(
      "11/02/2026,TIM HORTONS #44,4.25,,1200.00\n11/03/2026,PAYROLL,,1500.00,2700.00\n11/03/2026,HYDRO QUEBEC,88.10,,2611.90",
    );
    const mapping = guessMapping(rows);
    expect(mapping).toMatchObject({
      hasHeader: false,
      date: 0,
      description: 1,
      amount: null,
      debit: 2,
      credit: 3,
    });
    const read = readImportRows(rows, mapping);
    expect(read.rows.map((entry) => entry.cents)).toEqual([
      -425, 150000, -8810,
    ]);
  });

  it("compte les lignes qui ne se lisent pas, inverse une carte de crédit", () => {
    const rows = [
      ["2026-11-01", "Achat", "25.00"],
      ["total", "", ""],
    ];
    const mapping = {
      hasHeader: false,
      date: 0,
      description: 1,
      amount: 2,
      debit: null,
      credit: null,
      dateOrder: "ymd" as const,
      invert: true,
    };
    expect(readImportRows(rows, mapping)).toEqual({
      rows: [{ date: "2026-11-01", cents: -2500, description: "Achat" }],
      skipped: 1,
    });
  });

  it("une première catégorie : l'historique d'abord, puis les commerces connus", () => {
    expect(normalizeDescription("IGA #8123 MONTRÉAL")).toBe("iga montreal");
    expect(guessCategory("IGA #8123 MONTRÉAL", new Map())).toBe("groceries");
    expect(guessCategory("Hydro-Québec", new Map())).toBe("utilities");
    expect(guessCategory("NETFLIX.COM", new Map())).toBe("subscriptions");
    expect(guessCategory("Bellevue boutique", new Map())).toBe("other");
    expect(guessCategory("IGA #2", new Map([["iga", "restaurants"]]))).toBe(
      "restaurants",
    );
    expect(guessCategory(null, new Map())).toBe("other");
  });

  it("deux cafés identiques restent deux lignes ; le même fichier, les mêmes empreintes", () => {
    const coffee = { date: "2026-11-04", cents: -325, description: "Café" };
    const numbered = withOccurrences([
      coffee,
      coffee,
      { ...coffee, cents: -400 },
    ]);
    expect(numbered.map((entry) => entry.occurrence)).toEqual([0, 1, 0]);
    expect(importIdentity("a", coffee, 0)).not.toBe(
      importIdentity("a", coffee, 1),
    );
    expect(importIdentity("a", coffee, 0)).toBe(
      importIdentity("a", { ...coffee }, 0),
    );
  });
});

describe("export", () => {
  it("neutralise une cellule qui serait exécutée par un tableur", () => {
    expect(csvCell("=HYPERLINK(1)", ",")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@SUM", ",")).toBe("'@SUM");
    expect(csvCell("-42,10", ";")).toBe("-42,10");
    expect(csvCell("a;b", ";")).toBe('"a;b"');
    expect(csvCell('dit "oui"', ",")).toBe('"dit ""oui"""');
  });

  it("le séparateur d'Excel en français", () => {
    expect(toCsv([["a", "b"]], "fr")).toBe("﻿a;b\r\n");
    expect(toCsv([["a", "b"]], "en")).toBe("﻿a,b\r\n");
  });
});

describe("rapports", () => {
  const rollups = rollupMonths(
    [
      row("2026-09", "expense", "groceries", 40000),
      row("2026-10", "income", null, 300000),
      row("2026-10", "expense", "groceries", 50000),
      row("2026-11", "income", null, 300000),
      row("2026-11", "expense", "groceries", 60000),
      row("2026-11", "expense", "restaurants", 30000),
      row("2026-11", "expense", "savings", 60000),
    ],
    NO_TYPES,
  );

  it("ce qui entre et sort, et le taux d'épargne", () => {
    const points = cashFlow(rollups, ["2026-10", "2026-11"]);
    expect(points[1]).toEqual({
      month: "2026-11",
      incomeCents: 300000,
      spentCents: 90000,
      savedCents: 60000,
      netCents: 150000,
    });
    expect(savingsRate(points)).toBe(10);
    expect(savingsRate(cashFlow(rollups, ["2026-09"]))).toBeNull();
  });

  it("chaque catégorie comparée à la moyenne des mois d'avant", () => {
    expect(categoryTrends(rollups, "2026-11")).toEqual([
      { key: "groceries", cents: 60000, averageCents: 45000 },
      { key: "restaurants", cents: 30000, averageCents: 0 },
    ]);
  });

  it("la répartition, à côté du repère 50/30/20", () => {
    const shares = groupShares(
      [{ rollup: rollups.get("2026-11") }],
      categories,
    );
    expect(shares.needs).toMatchObject({ cents: 60000, percent: 20 });
    expect(shares.wants).toMatchObject({ cents: 30000, percent: 10 });
    expect(shares.savings).toMatchObject({ cents: 60000, percent: 20 });
  });
});

describe("filtres des transactions", () => {
  it("ignore ce qui n'est pas valide", () => {
    expect(
      parseTransactionFilters({
        q: "  café ",
        cat: "groceries",
        type: "transfer",
        account: "pas-un-id",
        month: "2026-13",
        limit: "999999",
      }),
    ).toEqual({
      q: "café",
      category: "groceries",
      type: "transfer",
      account: null,
      month: null,
      limit: 2000,
    });
    expect(parseTransactionFilters({}).limit).toBe(100);
  });
});
