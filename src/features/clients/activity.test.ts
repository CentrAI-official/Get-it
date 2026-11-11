import { describe, expect, it } from "vitest";
import {
  activityDays,
  clientFlag,
  combineDay,
  lastActiveLabel,
  matchesClient,
  needsNudge,
  planDay,
  sortClients,
  summarizeActivity,
} from "./activity";

describe("ce que le client fait de ses plans partagés", () => {
  it("les 7 derniers jours, aujourd'hui compris", () => {
    expect(activityDays("2026-11-10")).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
    ]);
  });

  it("un élément coché pour un élément prévu, une séance pour l'entraînement", () => {
    expect(
      planDay({ kind: "nutrition", items: 4, logged: 3, workout: false }),
    ).toEqual({
      planned: 4,
      done: 3,
      active: true,
    });
    // Jamais plus que prévu (une séance d'avance cochée aujourd'hui)
    expect(
      planDay({ kind: "mental", items: 1, logged: 3, workout: false }).done,
    ).toBe(1);
    // L'entraînement : la séance du carnet, peu importe le nombre d'exercices
    expect(
      planDay({ kind: "physical", items: 6, logged: 0, workout: true }),
    ).toEqual({
      planned: 1,
      done: 1,
      active: true,
    });
    // Une séance un jour de repos : actif, mais rien de prévu
    expect(
      planDay({ kind: "physical", items: 0, logged: 0, workout: true }),
    ).toEqual({
      planned: 0,
      done: 0,
      active: true,
    });
  });

  it("le résumé : jours actifs, part faite, jours où tout est fait", () => {
    const days = [
      combineDay("2026-11-04", [
        planDay({ kind: "nutrition", items: 3, logged: 3, workout: false }),
        planDay({ kind: "physical", items: 5, logged: 0, workout: true }),
      ]),
      combineDay("2026-11-05", [
        planDay({ kind: "nutrition", items: 3, logged: 1, workout: false }),
      ]),
      combineDay("2026-11-06", [
        planDay({ kind: "nutrition", items: 0, logged: 0, workout: false }),
      ]),
      combineDay("2026-11-07", [
        planDay({ kind: "nutrition", items: 3, logged: 0, workout: false }),
      ]),
    ];
    expect(days[0]).toEqual({
      day: "2026-11-04",
      planned: 4,
      done: 4,
      active: true,
    });
    const summary = summarizeActivity(days);
    expect(summary).toMatchObject({
      activeDays: 2,
      plannedDays: 3,
      fullDays: 1,
      planned: 10,
      done: 5,
      percent: 50,
    });
    expect(summarizeActivity([]).percent).toBeNull();
  });
});

describe("à relancer", () => {
  const summary = { planned: 6 };

  it("rien de fait depuis 5 jours alors que c'était prévu", () => {
    expect(
      needsNudge({
        summary,
        lastActiveDay: "2026-11-05",
        sinceDay: "2026-10-01",
        today: "2026-11-10",
      }),
    ).toBe(true);
    expect(
      needsNudge({
        summary,
        lastActiveDay: "2026-11-06",
        sinceDay: "2026-10-01",
        today: "2026-11-10",
      }),
    ).toBe(false);
    expect(
      needsNudge({
        summary,
        lastActiveDay: null,
        sinceDay: "2026-10-01",
        today: "2026-11-10",
      }),
    ).toBe(true);
  });

  it("jamais sans rien de prévu, ni un client tout nouveau", () => {
    expect(
      needsNudge({
        summary: { planned: 0 },
        lastActiveDay: null,
        sinceDay: "2026-10-01",
        today: "2026-11-10",
      }),
    ).toBe(false);
    expect(
      needsNudge({
        summary,
        lastActiveDay: null,
        sinceDay: "2026-11-07",
        today: "2026-11-10",
      }),
    ).toBe(false);
  });

  it("le signal de la ligne : à relancer, puis en attente, puis accepté", () => {
    expect(
      clientFlag({
        nudge: true,
        pendingProposal: true,
        acceptedRecently: true,
      }),
    ).toBe("nudge");
    expect(
      clientFlag({
        nudge: false,
        pendingProposal: true,
        acceptedRecently: true,
      }),
    ).toBe("pending");
    expect(
      clientFlag({
        nudge: false,
        pendingProposal: false,
        acceptedRecently: true,
      }),
    ).toBe("accepted");
    expect(
      clientFlag({
        nudge: false,
        pendingProposal: false,
        acceptedRecently: false,
      }),
    ).toBeNull();
  });
});

describe("la liste", () => {
  const now = new Date("2026-11-10T20:00:00Z").getTime();

  it("la dernière activité en mots", () => {
    expect(lastActiveLabel(null, now)).toEqual({ key: "never", count: 0 });
    expect(lastActiveLabel("2026-11-10T19:58:00Z", now)).toEqual({
      key: "minutes",
      count: 2,
    });
    expect(lastActiveLabel("2026-11-10T19:59:50Z", now)).toEqual({
      key: "minutes",
      count: 1,
    });
    expect(lastActiveLabel("2026-11-10T17:00:00Z", now)).toEqual({
      key: "hours",
      count: 3,
    });
    expect(lastActiveLabel("2026-11-09T10:00:00Z", now)).toEqual({
      key: "yesterday",
      count: 1,
    });
    expect(lastActiveLabel("2026-11-01T20:00:00Z", now)).toEqual({
      key: "days",
      count: 9,
    });
  });

  const rows = [
    {
      name: "Thomas",
      lastActiveAt: "2026-11-10T19:00:00Z",
      flag: null,
      percent: 71,
    },
    {
      name: "Émilie",
      lastActiveAt: "2026-11-10T17:00:00Z",
      flag: "pending" as const,
      percent: 75,
    },
    {
      name: "Marc-André",
      lastActiveAt: "2026-11-01T10:00:00Z",
      flag: "nudge" as const,
      percent: 0,
    },
    { name: "Nouveau", lastActiveAt: null, flag: null, percent: null },
    {
      name: "Léa",
      lastActiveAt: "2026-11-08T10:00:00Z",
      flag: "nudge" as const,
      percent: 25,
    },
  ];

  it("trier : activité récente, à relancer d'abord, nom", () => {
    const names = (sort: Parameters<typeof sortClients>[1]) =>
      sortClients(rows, sort).map((row) => row.name);
    expect(names("recent")).toEqual([
      "Thomas",
      "Émilie",
      "Léa",
      "Marc-André",
      "Nouveau",
    ]);
    expect(names("nudge")).toEqual([
      "Marc-André",
      "Léa",
      "Thomas",
      "Émilie",
      "Nouveau",
    ]);
    expect(names("name")).toEqual([
      "Émilie",
      "Léa",
      "Marc-André",
      "Nouveau",
      "Thomas",
    ]);
  });

  it("chercher sans accents ni majuscules, par nom ou @", () => {
    const person = { displayName: "Émilie Côté", username: "emi_cote" };
    expect(matchesClient(person, "emilie")).toBe(true);
    expect(matchesClient(person, "COTE")).toBe(true);
    expect(matchesClient(person, "@emi_")).toBe(true);
    expect(matchesClient(person, "thomas")).toBe(false);
    expect(matchesClient(person, "  ")).toBe(true);
  });
});
