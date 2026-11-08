import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildProposedSchedule,
  PROPOSAL_LIMITS,
  sameSchedule,
  scheduleDiff,
  scheduleEditSchema,
  type Schedule,
} from "./proposals";

const REF = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

const current: Schedule = [
  {
    weekday: 1,
    moment: "morning",
    time: 420,
    title: "Haut du corps",
    items: [
      { name: "Développé couché", detail: "4 × 8", ref: REF },
      { name: "Tractions", detail: "3 × 6", ref: null },
    ],
  },
  {
    weekday: 4,
    moment: null,
    time: null,
    title: "Bas du corps",
    items: [{ name: "Squat", detail: "4 × 6", ref: null }],
  },
];

describe("scheduleEditSchema", () => {
  it("accepte une semaine valide", () => {
    expect(
      scheduleEditSchema.safeParse([
        {
          weekday: 2,
          title: "Cardio",
          items: [{ name: "Course", detail: "" }],
        },
      ]).success,
    ).toBe(true);
  });

  it("refuse une séance sans titre ou sans élément, et un jour en double", () => {
    const day = {
      weekday: 1,
      title: "Haut",
      items: [{ name: "A", detail: "" }],
    };
    expect(scheduleEditSchema.safeParse([{ ...day, title: " " }]).success).toBe(
      false,
    );
    expect(scheduleEditSchema.safeParse([{ ...day, items: [] }]).success).toBe(
      false,
    );
    expect(scheduleEditSchema.safeParse([day, day]).success).toBe(false);
    expect(scheduleEditSchema.safeParse([{ ...day, weekday: 8 }]).success).toBe(
      false,
    );
  });
});

describe("buildProposedSchedule", () => {
  it("garde le moment, l'heure et la fiche du catalogue de ce qui existe", () => {
    const after = buildProposedSchedule(current, [
      {
        weekday: 1,
        title: "Haut du corps",
        items: [
          { name: "développé couché", detail: "5 × 5" },
          { name: "Dips", detail: "3 × 10" },
        ],
      },
      {
        weekday: 6,
        title: "Mobilité",
        items: [{ name: "Étirements", detail: "" }],
      },
    ]);
    expect(after[0]).toMatchObject({
      weekday: 1,
      moment: "morning",
      time: 420,
    });
    expect(after[0]?.items[0]?.ref).toBe(REF);
    expect(after[0]?.items[1]?.ref).toBeNull();
    // Nouveau jour : sans moment ni heure (le client choisira)
    expect(after[1]).toMatchObject({ weekday: 6, moment: null, time: null });
  });

  it("range les jours dans l'ordre de la semaine", () => {
    const after = buildProposedSchedule(current, [
      { weekday: 5, title: "B", items: [{ name: "B", detail: "" }] },
      { weekday: 2, title: "A", items: [{ name: "A", detail: "" }] },
    ]);
    expect(after.map((day) => day.weekday)).toEqual([2, 5]);
  });
});

describe("sameSchedule", () => {
  it("reconnaît la même semaine, quel que soit l'ordre des jours", () => {
    expect(sameSchedule(current, [...current].reverse())).toBe(true);
    const edited = structuredClone(current);
    if (edited[1]?.items[0]) edited[1].items[0].detail = "5 × 5";
    expect(sameSchedule(current, edited)).toBe(false);
  });
});

describe("scheduleDiff", () => {
  it("montre ce qui change, jour par jour", () => {
    const after = buildProposedSchedule(current, [
      {
        weekday: 1,
        title: "Haut du corps — force",
        items: [
          { name: "Développé couché", detail: "5 × 5" },
          { name: "Dips", detail: "3 × 10" },
        ],
      },
      {
        weekday: 6,
        title: "Mobilité",
        items: [{ name: "Étirements", detail: "" }],
      },
    ]);
    const changes = scheduleDiff(current, after);
    expect(changes.map((change) => [change.weekday, change.status])).toEqual([
      [1, "changed"],
      [4, "removed"],
      [6, "added"],
    ]);
    const monday = changes[0];
    expect(monday?.titleAfter).toBe("Haut du corps — force");
    expect(monday?.added.map((item) => item.name)).toEqual(["Dips"]);
    expect(monday?.removed.map((item) => item.name)).toEqual(["Tractions"]);
    expect(monday?.changed[0]?.after.detail).toBe("5 × 5");
  });

  it("rien ne change : aucune ligne", () => {
    expect(scheduleDiff(current, current)).toEqual([]);
  });
});

describe("alignement avec la migration", () => {
  it("les limites sont celles de la base", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261123120000_plan_proposals/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(`char_length("note") <= ${PROPOSAL_LIMITS.note}`);
    expect(sql).toContain(`jsonb_array_length("after") <= 7`);
    expect(sql).toContain(
      'ALTER TABLE "plan_proposals" ENABLE ROW LEVEL SECURITY',
    );
  });
});
