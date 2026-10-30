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
  eventMoment,
  occursOn,
} from "./rules";

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

  it("accepte un événement sur plusieurs jours, pas plus de 14", () => {
    expect(
      eventFormSchema.safeParse({
        ...valid,
        endDate: "2026-10-27",
        endTime: "08:00",
      }).success,
    ).toBe(true);
    const result = eventFormSchema.safeParse({
      ...valid,
      endDate: "2026-11-10",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(eventFieldErrors(result.error)).toEqual({ endDate: "tooLong" });
    }
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

describe("eventMoment", () => {
  it("place l'événement dans le matin, le midi ou le soir", () => {
    expect(eventMoment(9 * 60)).toBe("morning");
    expect(eventMoment(12 * 60 + 15)).toBe("noon");
    expect(eventMoment(18 * 60)).toBe("evening");
  });
});

describe("migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261103120000_calendar_events/migration.sql",
    ),
    "utf8",
  );
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
    expect(sql).toContain(`AS ENUM (${values})`);
    const block = /enum EventRepeat \{([^}]*)\}/.exec(schema)?.[1] ?? "";
    expect(block.trim().split(/\s+/)).toEqual([...EVENT_REPEATS]);
  });
});
