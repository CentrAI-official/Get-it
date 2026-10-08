import { describe, expect, it } from "vitest";
import { getDayPeriod } from "./day-period";

describe("getDayPeriod", () => {
  // 7 oct. 2026, 14 h UTC = 10 h à Toronto, 16 h à Paris, 23 h à Tokyo
  const date = new Date("2026-10-07T14:00:00Z");

  it("dépend du fuseau de l'utilisateur", () => {
    expect(getDayPeriod(date, "America/Toronto")).toBe("morning");
    expect(getDayPeriod(date, "Europe/Paris")).toBe("afternoon");
    expect(getDayPeriod(date, "Asia/Tokyo")).toBe("evening");
  });

  it("considère la nuit comme le soir", () => {
    expect(
      getDayPeriod(new Date("2026-10-07T07:00:00Z"), "America/Toronto"),
    ).toBe("evening");
  });
});
