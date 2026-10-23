import { describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "@/lib/dates";
import {
  addMonths,
  dayEntries,
  DEFAULT_PLAN_DAYS,
  markedDays,
  MAX_PLAN_DAYS,
  monthGrid,
  monthRange,
  planPeriod,
  sessionOn,
  type CalendarData,
  type CalendarPlan,
} from "./calendar";

// Jeudi 22 octobre 2026
const TODAY = "2026-10-22";

const plan: CalendarPlan = {
  id: "p1",
  kind: "physical",
  title: "Plan",
  startsOn: TODAY,
  endsOn: "2026-11-30",
  schedule: [
    {
      weekday: 1,
      title: "Haut du corps",
      items: [{ name: "Pompes", detail: "3 × 10" }],
    },
    {
      weekday: 4,
      title: "Bas du corps",
      items: [{ name: "Squats", detail: "3 × 12" }],
    },
  ],
};

const data: CalendarData = {
  month: "2026-10",
  today: TODAY,
  plans: [plan],
  tasks: [
    {
      id: "t1",
      title: "Acheter des espadrilles",
      dueDate: "2026-10-24",
      done: false,
      planKind: "physical",
    },
  ],
  habits: [
    {
      id: "h1",
      title: "Marcher 20 min",
      weekdays: [6, 7],
      from: "2026-10-10",
      until: null,
      doneDays: ["2026-10-17"],
      planKind: null,
    },
  ],
  goals: [
    {
      id: "g1",
      title: "Courir 10 km",
      targetDate: "2026-10-31",
      done: false,
      planKind: "physical",
    },
  ],
};

describe("mois", () => {
  it("bornes et années bissextiles", () => {
    expect(monthRange("2026-02")).toEqual({
      first: "2026-02-01",
      last: "2026-02-28",
    });
    expect(monthRange("2028-02").last).toBe("2028-02-29");
    expect(monthRange("2026-10").last).toBe("2026-10-31");
  });

  it("passe d'une année à l'autre", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("grille du lundi au dimanche, jours hors du mois vides", () => {
    const grid = monthGrid("2026-10");
    expect(grid.every((week) => week.length === 7)).toBe(true);
    const days = grid.flat().filter((day): day is string => day !== null);
    expect(days).toHaveLength(31);
    expect(grid[0]?.indexOf("2026-10-01")).toBe(isoWeekday("2026-10-01") - 1);
  });
});

describe("séances", () => {
  it("la semaine type se répète seulement sur la période du plan", () => {
    expect(sessionOn(plan, TODAY)?.title).toBe("Bas du corps");
    expect(sessionOn(plan, "2026-10-26")?.title).toBe("Haut du corps");
    // Lundi avant le début, et jeudi après la fin
    expect(sessionOn(plan, "2026-10-19")).toBeNull();
    expect(sessionOn(plan, "2026-12-03")).toBeNull();
    // Mardi : pas de séance
    expect(sessionOn(plan, "2026-10-27")).toBeNull();
  });
});

describe("jour du calendrier", () => {
  it("rassemble séance, tâche, objectif et habitudes du jour", () => {
    expect(dayEntries(data, TODAY).sessions).toHaveLength(1);
    expect(dayEntries(data, "2026-10-24").tasks.map((task) => task.id)).toEqual(
      ["t1"],
    );
    expect(dayEntries(data, "2026-10-31").goals.map((goal) => goal.id)).toEqual(
      ["g1"],
    );
    expect(dayEntries(data, "2026-10-17").habits).toEqual([
      { habit: data.habits[0], done: true },
    ]);
    // Avant sa création, l'habitude n'apparaît pas
    expect(dayEntries(data, "2026-10-04").habits).toEqual([]);
  });

  it("marque les jours de séance, de tâche et d'objectif, pas ceux des habitudes", () => {
    const marked = markedDays(data);
    expect(marked.has(TODAY)).toBe(true);
    expect(marked.has("2026-10-26")).toBe(true);
    expect(marked.has("2026-10-24")).toBe(true);
    expect(marked.has("2026-10-31")).toBe(true);
    // Samedi 17 : seulement une habitude
    expect(marked.has("2026-10-17")).toBe(false);
    // Lundi 19 : avant le début du plan
    expect(marked.has("2026-10-19")).toBe(false);
  });
});

describe("planPeriod", () => {
  it("va jusqu'à la date visée du questionnaire", () => {
    expect(planPeriod(TODAY, "2027-03-01", 30)).toEqual({
      startsOn: TODAY,
      endsOn: "2027-03-01",
    });
  });

  it("sinon la date de l'objectif proposé, sinon 12 semaines", () => {
    expect(planPeriod(TODAY, "2020-01-01", 30).endsOn).toBe(addDays(TODAY, 30));
    expect(planPeriod(TODAY, undefined, null).endsOn).toBe(
      addDays(TODAY, DEFAULT_PLAN_DAYS),
    );
    expect(planPeriod(TODAY, undefined, 2).endsOn).toBe(addDays(TODAY, 7));
  });

  it("jamais plus de 5 ans", () => {
    expect(planPeriod(TODAY, "2099-01-01", null).endsOn).toBe(
      addDays(TODAY, MAX_PLAN_DAYS),
    );
    expect(planPeriod(TODAY, undefined, 99999).endsOn).toBe(
      addDays(TODAY, MAX_PLAN_DAYS),
    );
  });
});
