import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMUNITY_EVENT_LIMITS,
  communityEventFieldErrors,
  communityEventFormSchema,
  eventCommentSchema,
  needsReminder,
  parseEventFilters,
  reminderDue,
  safeUrl,
  spotsLeft,
  whenRange,
} from "./rules";

const TODAY = "2026-11-10"; // un mardi
const schema = communityEventFormSchema(TODAY);
const valid = {
  locale: "fr",
  title: "  Course du samedi au parc  ",
  description: "On court 5 km ensemble, tous les rythmes.",
  topic: "physical",
  format: "in_person",
  location: "Parc La Fontaine, Montréal",
  region: "montreal",
  onlineUrl: "",
  startDate: "2026-11-14",
  startTime: "09:00",
  endDate: "",
  endTime: "",
  capacity: "",
};

describe("formulaire d'un événement", () => {
  it("valide une rencontre en personne, sans fin ni limite de places", () => {
    expect(schema.parse(valid)).toEqual({
      locale: "fr",
      title: "Course du samedi au parc",
      description: "On court 5 km ensemble, tous les rythmes.",
      topic: "physical",
      format: "in_person",
      location: "Parc La Fontaine, Montréal",
      region: "montreal",
      onlineUrl: null,
      startDay: "2026-11-14",
      startMinute: 9 * 60,
      endDay: null,
      endMinute: null,
      capacity: null,
    });
  });

  it("en ligne : un lien https, et le lieu est ignoré", () => {
    const parsed = schema.parse({
      ...valid,
      format: "online",
      onlineUrl: "https://meet.example.com/abc",
      topic: "",
    });
    expect(parsed).toMatchObject({
      location: null,
      region: null,
      onlineUrl: "https://meet.example.com/abc",
      topic: null,
    });
    const insecure = schema.safeParse({
      ...valid,
      format: "online",
      onlineUrl: "http://meet.example.com/abc",
    });
    expect(insecure.success).toBe(false);
    if (!insecure.success) {
      expect(communityEventFieldErrors(insecure.error)).toMatchObject({
        onlineUrl: "urlInvalid",
      });
    }
  });

  it("refuse un lieu manquant, une date passée et une fin avant le début", () => {
    const result = schema.safeParse({
      ...valid,
      location: " ",
      startDate: "2026-11-09",
      endTime: "08:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(communityEventFieldErrors(result.error)).toMatchObject({
        location: "locationRequired",
        startDate: "inPast",
        endTime: "endBeforeStart",
      });
    }
  });

  it("dure 14 jours au plus, et une capacité réaliste", () => {
    expect(
      schema.safeParse({ ...valid, endDate: "2026-11-28", endTime: "09:00" })
        .success,
    ).toBe(true);
    const long = schema.safeParse({
      ...valid,
      endDate: "2026-11-29",
      endTime: "09:00",
    });
    expect(long.success).toBe(false);
    expect(schema.safeParse({ ...valid, capacity: "1" }).success).toBe(false);
    expect(schema.parse({ ...valid, capacity: "25" }).capacity).toBe(25);
  });
});

describe("filtres de l'annuaire", () => {
  it("lit l'adresse et ignore le reste", () => {
    expect(
      parseEventFilters({ quand: "weekend", ou: "near", sujet: "mental" }),
    ).toEqual({ when: "weekend", where: "near", topic: "mental", mine: false });
    expect(parseEventFilters({ quand: "x", vue: "miens" })).toEqual({
      when: "all",
      where: "all",
      topic: null,
      mine: true,
    });
  });

  it("la fin de semaine : samedi et dimanche qui viennent", () => {
    expect(whenRange("weekend", TODAY)).toEqual({
      from: "2026-11-14",
      to: "2026-11-15",
    });
    // Le samedi : aujourd'hui et demain ; le dimanche : aujourd'hui
    expect(whenRange("weekend", "2026-11-14")).toEqual({
      from: "2026-11-14",
      to: "2026-11-15",
    });
    expect(whenRange("weekend", "2026-11-15")).toEqual({
      from: "2026-11-15",
      to: "2026-11-15",
    });
    expect(whenRange("week", TODAY).to).toBe("2026-11-16");
    expect(whenRange("all", TODAY).to).toBeNull();
  });

  it("places restantes et liens sûrs", () => {
    expect(spotsLeft(null, 40)).toBeNull();
    expect(spotsLeft(10, 12)).toBe(0);
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("https://zoom.us/j/1")).toBe("https://zoom.us/j/1");
  });
});

describe("alignement avec la migration", () => {
  it("les limites sont celles de la base", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261125120000_community_events/migration.sql",
      ),
      "utf8",
    );
    const limits = COMMUNITY_EVENT_LIMITS;
    expect(sql).toContain(
      `char_length("title") BETWEEN ${limits.titleMin} AND ${limits.titleMax}`,
    );
    expect(sql).toContain(
      `char_length("description") <= ${limits.description}`,
    );
    expect(sql).toContain(`BETWEEN 1 AND ${limits.location}`);
    expect(sql).toContain(`char_length("online_url") <= ${limits.url}`);
    expect(sql).toContain(`INTERVAL '${limits.maxDays} days'`);
    expect(sql).toContain(
      `"capacity" BETWEEN ${limits.capacityMin} AND ${limits.capacityMax}`,
    );
    expect(sql).toContain(
      'ALTER TABLE "community_events" ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).toContain(
      'ALTER TABLE "community_event_attendees" ENABLE ROW LEVEL SECURITY',
    );
  });

  it("la discussion a la même limite que la base, avec le RLS", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261126120000_events_lot2/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(
      `char_length("body") BETWEEN 1 AND ${COMMUNITY_EVENT_LIMITS.comment}`,
    );
    expect(sql).toContain(
      'ALTER TABLE "community_event_comments" ENABLE ROW LEVEL SECURITY',
    );
    // Au nom d'une page ou dans un groupe, jamais les deux
    expect(sql).toContain('CHECK ("page_id" IS NULL OR "group_id" IS NULL)');
  });
});

describe("discussion et rappel", () => {
  it("un message : ni vide, ni trop long", () => {
    expect(eventCommentSchema.parse("  On covoiture?  ")).toBe("On covoiture?");
    expect(eventCommentSchema.safeParse("   ").success).toBe(false);
    expect(
      eventCommentSchema.safeParse(
        "x".repeat(COMMUNITY_EVENT_LIMITS.comment + 1),
      ).success,
    ).toBe(false);
  });

  it("le rappel est dû dans les 24 heures avant le début, jamais après", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const inHours = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000);
    expect(reminderDue(inHours(23), now)).toBe(true);
    expect(reminderDue(inHours(24), now)).toBe(true);
    expect(reminderDue(inHours(25), now)).toBe(false);
    expect(reminderDue(inHours(-1), now)).toBe(false);
  });

  it("créé à moins de 24 h du début : pas de rappel à prévoir", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(needsReminder(new Date("2026-11-12T12:00:00Z"), now)).toBe(true);
    expect(needsReminder(new Date("2026-11-11T11:00:00Z"), now)).toBe(false);
  });
});
