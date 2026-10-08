import { describe, expect, it } from "vitest";
import { fromDbDate, toCalendarDay, toDbDate } from "./dates";

describe("jours du calendrier", () => {
  it("dépendent du fuseau de l'utilisateur", () => {
    // 8 oct. 2026, 2 h UTC : encore le 7 au soir à Toronto
    const instant = new Date("2026-10-08T02:00:00Z");
    expect(toCalendarDay(instant, "America/Toronto")).toBe("2026-10-07");
    expect(toCalendarDay(instant, "Europe/Paris")).toBe("2026-10-08");
  });

  it("font l'aller-retour avec une colonne date sans décalage", () => {
    expect(fromDbDate(toDbDate("2026-12-31"))).toBe("2026-12-31");
  });

  it("se comparent dans l'ordre chronologique", () => {
    expect("2026-09-30" < "2026-10-01").toBe(true);
  });
});
