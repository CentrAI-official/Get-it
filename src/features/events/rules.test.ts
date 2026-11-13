import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVENT_LOCATION_MAX,
  EVENT_MAX_DAYS,
  EVENT_REPEATS,
  EVENT_TITLE_MAX,
  eventFieldErrors,
  eventFormSchema,
  eventPartOn,
  occursOn,
} from "./rules";
import { momentOfMinute } from "@/config/moments";

const valid = {
  locale: "fr",
  title: "  Cuisiner les lunchs du lendemain ",
  location: "",
  startDate: "2026-10-26",
  startTime: "18:00",
  endDate: "2026-10-26",
  endTime: "19:00",
  repeat: "weekdays",
};

describe("eventFormSchema", () => {
  it("valide et convertit l'heure en minutes", () => {
    const parsed = eventFormSchema.parse(valid);
    expect(parsed).toEqual({
      locale: "fr",
      title: "Cuisiner les lunchs du lendemain",
      location: null,
      startsOn: "2026-10-26",
      startMinute: 18 * 60,
      endsOn: "2026-10-26",
      endMinute: 19 * 60,
      repeat: "weekdays",
    });
  });

  it("refuse une fin avant le début", () => {
    const result = eventFormSchema.safeParse({ ...valid, endTime: "17:30" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(eventFieldErrors(result.error)).toEqual({
        endTime: "endBeforeStart",
      });
    }
    expect(
      eventFormSchema.safeParse({ ...valid, endTime: "18:00" }).success,
    ).toBe(false);
  });

  it("accepte un événement de plusieurs jours, jusqu'à un an", () => {
    expect(
      eventFormSchema.safeParse({
        ...valid,
        endDate: "2026-10-27",
        endTime: "08:00",
      }).success,
    ).toBe(true);
    // Plus de 14 jours : des vacances, une session d'études
    expect(
      eventFormSchema.safeParse({ ...valid, endDate: "2026-12-20" }).success,
    ).toBe(true);
    const result = eventFormSchema.safeParse({
      ...valid,
      endDate: "2027-11-10",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(eventFieldErrors(result.error)).toEqual({ endDate: "tooLong" });
    }
  });

  it("sans fin : seulement le début compte", () => {
    const parsed = eventFormSchema.parse({
      ...valid,
      noEnd: "on",
      endDate: "",
      endTime: "",
    });
    expect(parsed).toMatchObject({ endsOn: null, endMinute: null });
    expect(
      eventFormSchema.parse({
        ...valid,
        noEnd: "on",
        endDate: undefined,
        endTime: undefined,
      }).endsOn,
    ).toBeNull();
  });

  it("refuse un titre vide ou trop long et une heure invalide", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      title: "   ",
      startTime: "25:00",
      location: "x".repeat(EVENT_LOCATION_MAX + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(eventFieldErrors(result.error)).toMatchObject({
        title: "titleRequired",
        startTime: "dateInvalid",
        location: "locationTooLong",
      });
    }
    expect(
      eventFormSchema.safeParse({
        ...valid,
        title: "x".repeat(EVENT_TITLE_MAX + 1),
      }).success,
    ).toBe(false);
  });
});

describe("occursOn", () => {
  // Le lundi 26 octobre 2026
  const start = "2026-10-26";

  it("une seule fois, ou chaque jour à partir du début", () => {
    expect(occursOn({ startsOn: start, repeat: "none" }, start)).toBe(true);
    expect(occursOn({ startsOn: start, repeat: "none" }, "2026-10-27")).toBe(
      false,
    );
    expect(occursOn({ startsOn: start, repeat: "daily" }, "2026-12-01")).toBe(
      true,
    );
    expect(occursOn({ startsOn: start, repeat: "daily" }, "2026-10-25")).toBe(
      false,
    );
  });

  it("aux 2 jours", () => {
    const event = { startsOn: start, repeat: "every_two_days" as const };
    expect(occursOn(event, "2026-10-28")).toBe(true);
    expect(occursOn(event, "2026-10-29")).toBe(false);
    expect(occursOn(event, "2026-11-01")).toBe(true);
  });

  it("jours de semaine, fins de semaine, chaque semaine", () => {
    expect(
      occursOn({ startsOn: start, repeat: "weekdays" }, "2026-10-30"),
    ).toBe(true);
    expect(
      occursOn({ startsOn: start, repeat: "weekdays" }, "2026-10-31"),
    ).toBe(false);
    expect(
      occursOn({ startsOn: start, repeat: "weekends" }, "2026-11-01"),
    ).toBe(true);
    expect(
      occursOn({ startsOn: start, repeat: "weekends" }, "2026-11-02"),
    ).toBe(false);
    expect(occursOn({ startsOn: start, repeat: "weekly" }, "2026-11-02")).toBe(
      true,
    );
    expect(occursOn({ startsOn: start, repeat: "weekly" }, "2026-11-03")).toBe(
      false,
    );
  });

  it("chaque mois, en sautant les mois trop courts", () => {
    const event = { startsOn: "2026-10-31", repeat: "monthly" as const };
    expect(occursOn(event, "2026-12-31")).toBe(true);
    expect(occursOn(event, "2026-11-30")).toBe(false);
  });
});

describe("momentOfMinute", () => {
  it("range une heure dans le matin, le midi ou le soir", () => {
    expect(momentOfMinute(9 * 60)).toBe("morning");
    expect(momentOfMinute(12 * 60 + 15)).toBe("noon");
    expect(momentOfMinute(18 * 60)).toBe("evening");
  });
});

describe("migration", () => {
  const read = (name: string) =>
    readFileSync(
      join(process.cwd(), `prisma/migrations/${name}/migration.sql`),
      "utf8",
    );
  // Limites élargies le 2026-11-08 ; l'enum vient de la première migration
  const sql = read("20261124120000_corrections");
  const created = read("20261103120000_calendar_events");
  const schema = readFileSync(
    join(process.cwd(), "prisma/schema.prisma"),
    "utf8",
  );

  it("garde les mêmes limites que les règles", () => {
    expect(sql).toContain(`BETWEEN 1 AND ${EVENT_TITLE_MAX}`);
    expect(sql).toContain(`BETWEEN 1 AND ${EVENT_LOCATION_MAX}`);
    expect(sql).toContain(`"starts_on" + ${EVENT_MAX_DAYS}`);
  });

  it("a les mêmes répétitions que l'enum Prisma", () => {
    const values = EVENT_REPEATS.map((value) => `'${value}'`).join(", ");
    expect(created).toContain(`AS ENUM (${values})`);
    const block = /enum EventRepeat \{([^}]*)\}/.exec(schema)?.[1] ?? "";
    expect(block.trim().split(/\s+/)).toEqual([...EVENT_REPEATS]);
  });
});

describe("eventPartOn (événement de plusieurs jours)", () => {
  // Du jeudi 12 au dimanche 15 novembre 2026
  const trip = {
    startsOn: "2026-11-12",
    endsOn: "2026-11-15",
    repeat: "none" as const,
  };

  it("chaque jour de l'événement, du premier au dernier", () => {
    expect(eventPartOn(trip, "2026-11-11")).toBeNull();
    expect(eventPartOn(trip, "2026-11-12")).toEqual({
      part: "first",
      start: "2026-11-12",
    });
    expect(eventPartOn(trip, "2026-11-13")?.part).toBe("middle");
    expect(eventPartOn(trip, "2026-11-14")?.part).toBe("middle");
    expect(eventPartOn(trip, "2026-11-15")?.part).toBe("last");
    expect(eventPartOn(trip, "2026-11-16")).toBeNull();
  });

  it("un événement d'un jour, ou sans fin, est seul", () => {
    expect(
      eventPartOn({ ...trip, endsOn: "2026-11-12" }, "2026-11-12")?.part,
    ).toBe("single");
    expect(eventPartOn({ ...trip, endsOn: null }, "2026-11-12")?.part).toBe(
      "single",
    );
    expect(eventPartOn({ ...trip, endsOn: null }, "2026-11-13")).toBeNull();
  });

  it("une répétition de plusieurs jours : chaque semaine, du samedi au dimanche", () => {
    const weekend = {
      startsOn: "2026-11-14",
      endsOn: "2026-11-15",
      repeat: "weekly" as const,
    };
    expect(eventPartOn(weekend, "2026-11-21")).toEqual({
      part: "first",
      start: "2026-11-21",
    });
    expect(eventPartOn(weekend, "2026-11-22")).toEqual({
      part: "last",
      start: "2026-11-21",
    });
    expect(eventPartOn(weekend, "2026-11-23")).toBeNull();
  });
});
