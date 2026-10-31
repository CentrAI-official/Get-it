import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOnline, ONLINE_WINDOW_MS } from "./rules";

describe("présence en ligne", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const seen = (ms: number) => new Date(now.getTime() - ms);

  it("en ligne si vu dans les 2 dernières minutes", () => {
    expect(
      isOnline({ lastSeenAt: seen(30_000), showPresence: true }, true, now),
    ).toBe(true);
    expect(
      isOnline(
        { lastSeenAt: seen(ONLINE_WINDOW_MS + 1), showPresence: true },
        true,
        now,
      ),
    ).toBe(false);
    expect(isOnline({ lastSeenAt: null, showPresence: true }, true, now)).toBe(
      false,
    );
  });

  it("réciproque : caché d'un côté, invisible des deux", () => {
    expect(
      isOnline({ lastSeenAt: seen(1000), showPresence: false }, true, now),
    ).toBe(false);
    expect(
      isOnline({ lastSeenAt: seen(1000), showPresence: true }, false, now),
    ).toBe(false);
  });

  it("la migration crée les abonnements avec le RLS et sans s'abonner à soi-même", () => {
    const sql = readFileSync(
      new URL(
        "../../../prisma/migrations/20261108120000_presence_follows/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain('ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CHECK ("follower_id" <> "followed_id")');
    expect(sql).toContain('"show_presence" BOOLEAN NOT NULL DEFAULT true');
  });
});
