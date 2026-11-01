import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import fr from "../../../messages/fr.json";
import { analyticsBatchSchema, toEventRow } from "./events";
import {
  activitySummary,
  countActive,
  funnel,
  northStarShare,
  rankUsage,
  relativeChange,
  weekStart,
  weeklyCohorts,
} from "./metrics";
import {
  ADMIN_AUDIT_ACTIONS,
  ANALYTICS_ENVS,
  ANALYTICS_EVENTS,
  ANALYTICS_FEATURES,
  MAX_BATCH,
  MAX_SLICE_MS,
  parsePeriod,
} from "./rules";
import {
  ANALYTICS_CATEGORIES,
  ANALYTICS_SECTIONS,
  categoryOf,
  resolvePath,
} from "./sections";

const POST_ID = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";
const SESSION = "0192f3a4-0000-7000-8000-000000000001";

describe("sections mesurées", () => {
  it("ramène une adresse à sa section, sans la langue ni la requête", () => {
    expect(resolvePath("/fr/community")).toEqual({
      section: "community.feed",
      route: "/community",
      target: null,
    });
    expect(resolvePath(`/en/community/posts/${POST_ID}?from=feed`)).toEqual({
      section: "community.post",
      route: "/community/posts/[id]",
      target: POST_ID,
    });
    expect(resolvePath("/fr/community/members/max_p").target).toBe("max_p");
  });

  it("préfère les adresses fixes aux adresses variables", () => {
    expect(resolvePath("/fr/groups/new").section).toBe("community.groups");
    expect(resolvePath("/fr/marketplace/gear").section).toBe(
      "marketplace.gear",
    );
    expect(resolvePath("/fr/services/events/new").section).toBe(
      "services.event",
    );
  });

  it("ne garde aucune cible pour ce qui est privé ou invalide", () => {
    expect(resolvePath(`/fr/messages/${POST_ID}`).target).toBeNull();
    expect(resolvePath(`/fr/goals/${POST_ID}`).target).toBeNull();
    expect(resolvePath("/fr/community/posts/<script>").target).toBeNull();
    expect(resolvePath("/fr/community/posts/<script>").section).toBe(
      "community.post",
    );
  });

  it("classe une adresse inconnue dans « autre »", () => {
    expect(resolvePath("/fr/nowhere/at/all")).toEqual({
      section: "other",
      route: null,
      target: null,
    });
    expect(categoryOf("community.storyViewer")).toBe("community");
    expect(categoryOf("weird")).toBe("other");
  });

  it("chaque page de l'application a sa section", () => {
    const appDir = fileURLToPath(
      new URL("../../app/[locale]", import.meta.url),
    );
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name === "page.tsx") pages.push(path);
      }
    };
    walk(join(appDir, "(app)"));
    walk(join(appDir, "(onboarding)"));
    const samples: Record<string, string> = {
      "[id]": POST_ID,
      "[username]": "max_p",
      "[kind]": "physical",
    };
    for (const page of pages) {
      const segments = relative(appDir, page)
        .split(sep)
        .slice(0, -1)
        .filter((segment) => !segment.startsWith("("))
        .map((segment) => samples[segment] ?? segment);
      const path = `/fr/${segments.join("/")}`;
      expect(resolvePath(path).section, path).not.toBe("other");
    }
  });

  it("chaque section, catégorie et fonction a son libellé", () => {
    const names = fr.Admin.sectionNames as Record<string, unknown>;
    for (const section of ANALYTICS_SECTIONS) {
      const [first = "", second] = section.split(".");
      const value = second
        ? (names[first] as Record<string, unknown> | undefined)?.[second]
        : names[first];
      expect(typeof value, section).toBe("string");
    }
    for (const category of ANALYTICS_CATEGORIES) {
      expect(fr.Admin.categories[category], category).toBeTypeOf("string");
    }
    for (const feature of ANALYTICS_FEATURES) {
      expect(fr.Admin.features.names[feature], feature).toBeTypeOf("string");
    }
  });
});

describe("événements reçus", () => {
  const time = {
    name: "time",
    sessionId: SESSION,
    at: Date.parse("2026-10-31T12:00:00Z"),
    path: `/fr/community/posts/${POST_ID}`,
    durationMs: 30_000,
  };

  it("accepte un lot valide", () => {
    expect(analyticsBatchSchema.safeParse({ events: [time] }).success).toBe(
      true,
    );
    expect(
      analyticsBatchSchema.safeParse({
        events: [
          {
            name: "open",
            sessionId: SESSION,
            at: time.at,
            overlay: "today.dayPanel",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("refuse les champs inconnus, le texte libre et les lots trop grands", () => {
    const refuses = (events: unknown[]) =>
      analyticsBatchSchema.safeParse({ events }).success === false;
    expect(refuses([{ ...time, note: "texte libre" }])).toBe(true);
    expect(refuses([{ ...time, overlay: "today.dayPanel" }])).toBe(true);
    expect(refuses([{ ...time, path: undefined }])).toBe(true);
    expect(refuses([{ ...time, durationMs: MAX_SLICE_MS + 1 }])).toBe(true);
    expect(refuses([{ ...time, name: "click" }])).toBe(true);
    expect(refuses(Array.from({ length: MAX_BATCH + 1 }, () => time))).toBe(
      true,
    );
    expect(refuses([])).toBe(true);
  });

  it("déduit la section et la cible du chemin, et corrige une date impossible", () => {
    const now = new Date("2026-10-31T12:00:30Z");
    const parsed = analyticsBatchSchema.parse({ events: [time] }).events[0];
    if (!parsed) throw new Error("événement attendu");
    expect(toEventRow(parsed, now)).toEqual({
      name: "time",
      sessionId: SESSION,
      section: "community.post",
      route: "/community/posts/[id]",
      target: POST_ID,
      durationMs: 30_000,
      occurredAt: new Date(time.at),
    });
    const old = { ...parsed, at: Date.parse("2026-10-01T00:00:00Z") };
    expect(toEventRow(old, now).occurredAt).toEqual(now);
    const overlay = toEventRow(
      {
        name: "open",
        sessionId: SESSION,
        at: time.at,
        overlay: "community.storyViewer",
      },
      now,
    );
    expect(overlay).toMatchObject({
      section: "community.storyViewer",
      route: null,
      durationMs: null,
    });
  });

  it("la migration suit les listes et active le RLS", () => {
    const sql = readFileSync(
      new URL(
        "../../../prisma/migrations/20261109120000_analytics/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const list = (values: readonly string[]) =>
      values.map((value) => `'${value}'`).join(", ");
    expect(sql).toContain(`"name" IN (${list(ANALYTICS_EVENTS)})`);
    expect(sql).toContain(`"env" IN (${list(ANALYTICS_ENVS)})`);
    expect(sql).toContain(`"action" IN (${list(ADMIN_AUDIT_ACTIONS)})`);
    expect(sql).toContain(`BETWEEN 1 AND ${MAX_SLICE_MS}`);
    expect(sql).toContain(
      'ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).toContain(
      'ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY',
    );
  });

  it("lit la période de l'adresse, 30 jours par défaut", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod(["90"])).toBe(90);
    expect(parsePeriod("365")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
  });
});

describe("calculs du dashboard", () => {
  const today = "2026-10-31";
  const day = (offset: number) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  it("compte les actifs du jour, de la semaine et du mois", () => {
    const days = [
      { userId: "a", day: today },
      { userId: "a", day: day(-1) },
      { userId: "b", day: day(-3) },
      { userId: "c", day: day(-20) },
      { userId: "d", day: day(-40) },
    ];
    const summary = activitySummary(days, today, 7);
    expect(summary).toMatchObject({
      dau: 1,
      wau: 2,
      mau: 3,
      activeInPeriod: 2,
    });
    expect(summary.series).toHaveLength(7);
    expect(summary.series.at(-1)).toEqual({ day: today, active: 1 });
    // 4 jours-personnes sur 30 jours, 3 personnes dans le mois
    expect(summary.stickiness).toBeCloseTo(4 / 30 / 3);
    expect(activitySummary([], today, 7).stickiness).toBeNull();
  });

  it("compare à la période précédente", () => {
    expect(relativeChange(12, 10)).toBeCloseTo(0.2);
    expect(relativeChange(5, 10)).toBeCloseTo(-0.5);
    expect(relativeChange(3, 0)).toBeNull();
    expect(relativeChange(null, 4)).toBeNull();
    const days = [
      { userId: "a", day: today },
      { userId: "a", day: day(-1) },
      { userId: "b", day: day(-8) },
    ];
    expect(countActive(days, day(-6), today)).toBe(1);
    expect(countActive(days, day(-13), day(-7))).toBe(1);
  });

  it("métrique étoile : 3 jours de progrès sur 7 parmi les actifs", () => {
    const activity = [
      { userId: "a", day: today },
      { userId: "b", day: today },
    ];
    const progress = [
      { userId: "a", day: today },
      { userId: "a", day: day(-2) },
      { userId: "a", day: day(-5) },
      { userId: "b", day: today },
      { userId: "b", day: day(-10) },
      { userId: "b", day: day(-11) },
    ];
    expect(northStarShare(activity, progress, today)).toBe(0.5);
    expect(northStarShare([], progress, today)).toBeNull();
  });

  it("classe du plus utilisé au moins utilisé", () => {
    const ranked = rankUsage(
      [
        { key: "rare", users: 1, total: 50 },
        { key: "popular", users: 8, total: 20 },
        { key: "unused", users: 0, total: 0 },
      ],
      10,
    );
    expect(ranked.map((row) => row.key)).toEqual(["popular", "rare", "unused"]);
    expect(ranked[0]).toMatchObject({ reach: 0.8, share: 20 / 70 });
    expect(rankUsage([{ key: "x", users: 0, total: 0 }], 0)[0]).toMatchObject({
      reach: null,
      share: null,
    });
  });

  it("semaines commençant le lundi", () => {
    expect(weekStart("2026-10-31")).toBe("2026-10-26");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });

  it("rétention par semaine d'inscription, sans compter les périodes à venir", () => {
    const signupDay = "2026-09-07"; // lundi, 54 jours avant aujourd'hui
    const members = [
      { userId: "a", signupDay },
      { userId: "b", signupDay },
      { userId: "new", signupDay: today },
    ];
    const activity = [
      { userId: "a", day: "2026-09-08" }, // lendemain
      { userId: "a", day: "2026-09-15" }, // 2e semaine
      { userId: "b", day: "2026-09-30" }, // 4e semaine (jours 21 à 27)
    ];
    const cohorts = weeklyCohorts(members, activity, today);
    const old = cohorts.find((cohort) => cohort.week === signupDay);
    expect(old).toEqual({
      week: signupDay,
      size: 2,
      day1: 0.5,
      weeks: [0.5, 0, 0.5, 0],
    });
    const current = cohorts[0];
    expect(current).toMatchObject({ week: "2026-10-26", size: 1, day1: null });
    expect(current?.weeks).toEqual([null, null, null, null]);
  });

  it("parcours : chaque étape compte qui l'a franchie", () => {
    expect(
      funnel([
        { onboarded: true, firstGoal: true, firstHabit: false, returned: true },
        {
          onboarded: true,
          firstGoal: false,
          firstHabit: false,
          returned: false,
        },
        {
          onboarded: false,
          firstGoal: false,
          firstHabit: false,
          returned: false,
        },
      ]),
    ).toEqual([
      { step: "signedUp", count: 3 },
      { step: "onboarded", count: 2 },
      { step: "firstGoal", count: 1 },
      { step: "firstHabit", count: 0 },
      { step: "returned", count: 1 },
    ]);
  });
});
