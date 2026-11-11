import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_KINDS,
  notificationText,
} from "@/features/notifications/rules";
import {
  canSettle,
  CHECK_DAYS_AHEAD,
  fixedPayments,
  occurrenceKey,
  outstandingIn,
  paysToConfirm,
  reminderDay,
  settledKeys,
  settleFrom,
  type FixedLog,
} from "./checklist";
import { repaidShare } from "./debts";
import { isFixedOnly, type PlanLine } from "./plan";
import { summarizeBudget, type BudgetRecurringRow } from "./rules";

const rule = (overrides: Partial<BudgetRecurringRow>): BudgetRecurringRow => ({
  id: "loyer",
  kind: "expense",
  label: "Loyer",
  category: "housing",
  amountCents: 120000,
  frequency: "monthly",
  startsOn: "2026-11-01",
  endsOn: null,
  accountId: null,
  toAccountId: null,
  postedThrough: null,
  createdOn: "2026-11-10",
  ...overrides,
});

const rent = rule({});
const pay = rule({
  id: "paie",
  kind: "income",
  label: "Salaire",
  category: null,
  amountCents: 150000,
  frequency: "biweekly",
  startsOn: "2026-10-30",
  createdOn: "2026-10-20",
});

const none: FixedLog = { paid: [], skipped: [] };
const days = (items: { day: string }[]) => items.map((item) => item.day);

describe("paiements fixes à cocher", () => {
  it("un budget créé le 10 : le loyer du 1er reste à cocher, rien n'est inscrit tout seul", () => {
    const due = outstandingIn(
      [rent],
      new Set(),
      "2026-11-01",
      "2026-11-30",
      "2026-11-10",
    );
    expect(days(due)).toEqual(["2026-11-01"]);
    // Coché : il n'est plus à venir
    const settled = new Set([occurrenceKey("loyer", "2026-11-01")]);
    expect(
      outstandingIn([rent], settled, "2026-11-01", "2026-11-30", "2026-11-10"),
    ).toEqual([]);
    // Le mois suivant : le 1er décembre s'en vient
    expect(
      days(
        outstandingIn(
          [rent],
          settled,
          "2026-12-01",
          "2026-12-31",
          "2026-11-10",
        ),
      ),
    ).toEqual(["2026-12-01"]);
  });

  it("jamais avant le mois où il a été ajouté, ni avant le mois d'avant", () => {
    const old = rule({ startsOn: "2024-03-15", createdOn: "2026-11-10" });
    expect(settleFrom(old, "2026-11-10")).toBe("2026-11-01");
    expect(
      days(
        outstandingIn(
          [old],
          new Set(),
          "2026-01-01",
          "2026-11-30",
          "2026-11-10",
        ),
      ),
    ).toEqual(["2026-11-15"]);
    // Ajouté il y a longtemps : seulement depuis le 1er du mois d'avant
    const longAgo = rule({ startsOn: "2025-01-01", createdOn: "2025-01-01" });
    expect(settleFrom(longAgo, "2026-11-10")).toBe("2026-10-01");
  });

  it("ce que l'ancien système a inscrit tout seul reste réglé", () => {
    const legacy = rule({
      startsOn: "2026-09-01",
      createdOn: "2026-09-01",
      postedThrough: "2026-11-09",
    });
    expect(settleFrom(legacy, "2026-11-10")).toBe("2026-11-10");
    expect(
      outstandingIn(
        [legacy],
        new Set(),
        "2026-11-01",
        "2026-11-30",
        "2026-11-10",
      ),
    ).toEqual([]);
    expect(
      days(
        outstandingIn(
          [legacy],
          new Set(),
          "2026-12-01",
          "2026-12-31",
          "2026-11-10",
        ),
      ),
    ).toEqual(["2026-12-01"]);
  });

  it("un paiement pas coché compte encore dans ce qui sort", () => {
    const upcoming = outstandingIn(
      [rent, pay],
      new Set(),
      "2026-11-01",
      "2026-11-30",
      "2026-11-10",
    );
    const summary = summarizeBudget({
      entries: [],
      upcoming,
      types: new Map(),
      start: "2026-11-01",
      end: "2026-11-30",
      today: "2026-11-10",
    });
    expect(summary.upcomingCents).toBe(120000);
    // Les paies du 13 et du 27, et celle du 30 octobre est d'un autre mois
    expect(summary.upcomingIncomeCents).toBe(300000);
  });

  it("l'état de chaque paiement du mois : payé, pas ce mois-ci, pas coché, à venir", () => {
    const phone = rule({
      id: "tel",
      label: "Téléphone",
      amountCents: 6500,
      startsOn: "2026-11-20",
    });
    const hydro = rule({
      id: "hydro",
      label: "Électricité",
      amountCents: 9000,
      startsOn: "2026-11-05",
    });
    const internet = rule({
      id: "net",
      label: "Internet",
      amountCents: 8000,
      startsOn: "2026-11-03",
    });
    const log: FixedLog = {
      paid: [{ recurringId: "hydro", day: "2026-11-05", amountCents: 8240 }],
      skipped: [{ recurringId: "net", day: "2026-11-03" }],
    };
    const items = fixedPayments(
      [rent, phone, hydro, internet],
      log,
      "2026-11-01",
      "2026-11-30",
      "2026-11-10",
    );
    expect(items.map((item) => `${item.label} ${item.state}`)).toEqual([
      "Loyer due",
      "Internet skipped",
      "Électricité paid",
      "Téléphone upcoming",
    ]);
    // Le montant payé cette fois, le prévu ne change pas
    expect(items[2]).toMatchObject({ paidCents: 8240, plannedCents: 9000 });
  });

  it("un paiement fait reste visible si la date a changé, un vieux pas coché non", () => {
    const moved = rule({ startsOn: "2026-11-03" });
    const log: FixedLog = {
      paid: [{ recurringId: "loyer", day: "2026-11-01", amountCents: 120000 }],
      skipped: [],
    };
    expect(
      fixedPayments([moved], log, "2026-11-01", "2026-11-30", "2026-11-10").map(
        (item) => `${item.day} ${item.state}`,
      ),
    ).toEqual(["2026-11-01 paid", "2026-11-03 due"]);
    // Avant le mois de son ajout : rien à cocher
    expect(
      fixedPayments([rent], none, "2026-10-01", "2026-10-31", "2026-11-10"),
    ).toEqual([]);
  });
});

describe("paies à confirmer", () => {
  it("chaque paie arrivée, la plus ancienne d'abord, jamais une paie à venir", () => {
    expect(days(paysToConfirm([rent, pay], new Set(), "2026-11-13"))).toEqual([
      "2026-10-30",
      "2026-11-13",
    ]);
    const settled = settledKeys({
      paid: [{ recurringId: "paie", day: "2026-10-30", amountCents: 120000 }],
      skipped: [{ recurringId: "paie", day: "2026-11-13" }],
    });
    expect(paysToConfirm([pay], settled, "2026-11-13")).toEqual([]);
    expect(paysToConfirm([pay], new Set(), "2026-10-29")).toEqual([]);
  });

  it("on règle depuis le mois d'avant ; une paie seulement une fois arrivée", () => {
    expect(canSettle(rent, "2026-10-01", "2026-11-10")).toBe(true);
    expect(canSettle(rent, "2026-09-30", "2026-11-10")).toBe(false);
    // Deux mois d'avance au plus
    expect(CHECK_DAYS_AHEAD).toBe(62);
    expect(canSettle(rent, "2027-01-11", "2026-11-10")).toBe(true);
    expect(canSettle(rent, "2027-01-12", "2026-11-10")).toBe(false);
    expect(canSettle(pay, "2026-11-13", "2026-11-10")).toBe(false);
    expect(canSettle(pay, "2026-11-10", "2026-11-10")).toBe(true);
  });
});

describe("rappel la veille", () => {
  const reminded = { ...rent, remindedOn: null };

  it("la veille, à partir de 9 h et jamais la nuit", () => {
    expect(reminderDay(reminded, "2026-11-30", 9)).toBe("2026-12-01");
    expect(reminderDay(reminded, "2026-11-30", 8)).toBeNull();
    expect(reminderDay(reminded, "2026-11-30", 22)).toBeNull();
    expect(reminderDay(reminded, "2026-11-29", 10)).toBeNull();
  });

  it("une seule fois, et jamais pour une paie", () => {
    expect(
      reminderDay({ ...reminded, remindedOn: "2026-12-01" }, "2026-11-30", 10),
    ).toBeNull();
    expect(
      reminderDay({ ...reminded, remindedOn: "2026-11-01" }, "2026-11-30", 10),
    ).toBe("2026-12-01");
    expect(
      reminderDay({ ...pay, remindedOn: null }, "2026-11-12", 10),
    ).toBeNull();
  });

  it("une notification par jour, regroupée, sans montant", () => {
    expect(NOTIFICATION_KINDS).toContain("bill_due");
    expect(
      notificationText("bill_due", {
        name: "Get iT",
        subject: "Loyer",
        count: 1,
      }).key,
    ).toBe("bill_due");
    expect(
      notificationText("bill_due", {
        name: "Get iT",
        subject: "Loyer",
        count: 3,
      }),
    ).toMatchObject({ key: "billsDue", values: { others: 2 } });
    const schema = readFileSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      "utf8",
    );
    expect(schema).toMatch(/enum NotificationKind \{[^}]*\bbill_due\b/);
  });
});

describe("barres des dettes et de l'épargne", () => {
  it("la part remboursée depuis l'ajout de la dette", () => {
    expect(repaidShare(500000, 340000)).toBeCloseTo(0.32);
    expect(repaidShare(500000, 0)).toBe(1);
    // Elle a grossi : rien de remboursé
    expect(repaidShare(500000, 600000)).toBe(0);
    // Une carte ouverte à 0 $ : rien à quoi se comparer
    expect(repaidShare(0, 120000)).toBeNull();
  });

  it("une catégorie faite de paiements fixes n'a pas de barre ; l'épargne, oui", () => {
    const line: PlanLine = {
      key: "housing",
      group: "needs",
      plannedCents: 120000,
      explicit: false,
      spentCents: 0,
      upcomingCents: 120000,
      fixedCents: 120000,
      carryCents: 0,
      availableCents: 0,
      rollover: false,
      variable: false,
    };
    expect(isFixedOnly(line)).toBe(true);
    // Un montant prévu plus grand que les fixes (l'essence en plus du paiement d'auto)
    expect(
      isFixedOnly({
        ...line,
        key: "transport",
        plannedCents: 60000,
        fixedCents: 35000,
      }),
    ).toBe(false);
    expect(isFixedOnly({ ...line, key: "savings", group: "savings" })).toBe(
      false,
    );
    expect(isFixedOnly({ ...line, fixedCents: 0, variable: true })).toBe(false);
  });
});

describe("migration", () => {
  it("les paiements qui n'ont pas eu lieu, le rappel et son réglage", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma",
        "migrations",
        "20261128120000_budget_checklist",
        "migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain('CREATE TABLE "budget_skips"');
    expect(sql).toContain(
      'ALTER TABLE "budget_skips" ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).toContain('ON "budget_skips"("recurring_id", "occurred_on")');
    expect(sql).toContain('ADD COLUMN "reminded_on" DATE');
    expect(sql).toContain('"bill_reminders" BOOLEAN NOT NULL DEFAULT true');
  });
});
