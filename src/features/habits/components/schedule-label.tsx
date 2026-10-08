"use client";

import { useFormatter, useTranslations } from "next-intl";
import { describeSchedule } from "../schemas";
import { weekdayDate } from "../weekdays";

/** « Tous les jours », « En semaine », « La fin de semaine » ou « lun., mer., ven. ». */
export function ScheduleLabel({ weekdays }: { weekdays: readonly number[] }) {
  const t = useTranslations("Habits.schedule");
  const format = useFormatter();
  const kind = describeSchedule(weekdays);
  if (kind !== "custom") return t(kind);

  return format.list(
    [...weekdays]
      .sort((a, b) => a - b)
      .map((weekday) =>
        format.dateTime(weekdayDate(weekday), {
          weekday: "short",
          timeZone: "UTC",
        }),
      ),
    { type: "conjunction" },
  );
}
