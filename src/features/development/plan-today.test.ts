import { describe, expect, it } from "vitest";
import type { CalendarPlan } from "./calendar";
import { dayStatus, itemParts, nextSessions } from "./plan-today";

describe("itemParts", () => {
  it("séries au-dessus, le reste du détail dessous", () => {
    expect(itemParts({ name: "Pompes", detail: "4 × 8, repos 90 s" })).toEqual({
      kicker: "4 × 8",
      name: "Pompes",
      sub: "Repos 90 s",
    });
    expect(itemParts({ name: "Respiration 4-7-8", detail: "5 min" })).toEqual({
      kicker: "5 min",
      name: "Respiration 4-7-8",
      sub: null,
    });
    expect(itemParts({ name: "Planche", detail: "" })).toEqual({
      kicker: null,
      name: "Planche",
      sub: null,
    });
  });

  it("dans un menu, le repas au-dessus du plat", () => {
    expect(
      itemParts({ name: "Souper — Saumon au four", detail: "1 portion" }),
    ).toEqual({ kicker: "Souper", name: "Saumon au four", sub: "1 portion" });
  });
});

describe("nextSessions", () => {
  // Lundi 2 novembre 2026 : séances le lundi, le mercredi et le vendredi
  const plan: CalendarPlan = {
    id: "plan",
    kind: "physical",
    title: "Plan",
    startsOn: "2026-10-19",
    endsOn: "2026-11-11",
    schedule: [1, 3, 5].map((weekday) => ({
      weekday,
      moment: null,
      time: null,
      title: `Séance ${weekday}`,
      items: [],
    })),
  };

  it("les prochaines séances, dans la période du plan seulement", () => {
    expect(nextSessions(plan, "2026-11-02").map((entry) => entry.day)).toEqual([
      "2026-11-04",
      "2026-11-06",
      "2026-11-09",
    ]);
    // Le plan finit le mercredi 11 : rien après
    expect(nextSessions(plan, "2026-11-09").map((entry) => entry.day)).toEqual([
      "2026-11-11",
    ]);
  });

  it("avant, pendant ou après le plan", () => {
    expect(dayStatus(plan, "2026-10-18")).toBe("before");
    expect(dayStatus(plan, "2026-11-02")).toBe("during");
    expect(dayStatus(plan, "2026-11-12")).toBe("after");
  });
});
