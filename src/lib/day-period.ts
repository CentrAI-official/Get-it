export type DayPeriod = "morning" | "afternoon" | "evening";

/** Moment de la journée dans le fuseau de l'utilisateur, pour le saluer correctement. */
export function getDayPeriod(date: Date, timeZone: string): DayPeriod {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(date),
  );
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}
