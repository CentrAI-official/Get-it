import { Trophy } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { toDbDate } from "@/lib/dates";
import {
  toDisplayWeight,
  type ExerciseProgress,
  type SetValues,
  type WeightUnit,
} from "../rules";
import { ExerciseChart } from "./exercise-chart-loader";
import { WeightUnitSwitch } from "./weight-unit-switch";

/**
 * Dans la fiche d'un exercice : mon record, ma courbe et mes dernières séances.
 * Lit seulement les séances de la personne connectée.
 */
export async function ExerciseHistory({
  progress,
  unit,
  title,
}: {
  progress: ExerciseProgress;
  unit: WeightUnit;
  title: string;
}) {
  const [t, tUnits, format] = await Promise.all([
    getTranslations("Library.history"),
    getTranslations("Workouts.units"),
    getFormatter(),
  ]);
  // Espace insécable : un poids ne se coupe pas en fin de ligne
  const weight = (grams: number) =>
    `${format.number(toDisplayWeight(grams, unit), {
      maximumFractionDigits: 2,
    })} ${tUnits(unit)}`;
  const describe = (set: SetValues) => {
    const load = set.weightGrams ? weight(set.weightGrams) : null;
    if (set.seconds) {
      return load
        ? t("weightSeconds", { weight: load, seconds: set.seconds })
        : t("seconds", { seconds: set.seconds });
    }
    if (set.reps !== null) {
      return load
        ? t("weightReps", { weight: load, reps: set.reps })
        : t("reps", { reps: set.reps });
    }
    return load ?? "";
  };
  const value = (raw: number) =>
    progress.metric === "weight" ? toDisplayWeight(raw, unit) : raw;
  const axisUnit =
    progress.metric === "weight"
      ? tUnits(unit)
      : progress.metric === "seconds"
        ? t("secondsUnit")
        : t("repsUnit");

  return (
    <section
      aria-labelledby="exercise-history"
      className="flex flex-col gap-5 border-t border-foreground/8 pt-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="exercise-history" className="caps-label text-muted-foreground">
          {t("title")}
        </h2>
        {/* kg ou lb : seulement quand l'exercice a des poids */}
        {progress.metric === "weight" ? <WeightUnitSwitch unit={unit} /> : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Trophy aria-hidden="true" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="caps-label text-muted-foreground">
            {t("record")}
          </span>
          <span className="font-display text-4xl leading-none tracking-wide uppercase tabular-nums">
            {describe(progress.best)}
          </span>
        </span>
      </div>

      {progress.points.length >= 2 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">
            {t(`chart.${progress.metric}`)}
          </h3>
          <ExerciseChart
            title={t("chartTitle", { title })}
            unit={axisUnit}
            points={progress.points.map((point) => ({
              day: point.day,
              value: value(point.value),
            }))}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t("last")}</h3>
        <ul className="flex flex-col">
          {progress.sessions.map((session, index) => (
            <li
              // Deux séances peuvent tomber le même jour
              key={`${session.day}-${index}`}
              className="flex flex-col gap-0.5 border-b border-foreground/8 py-2.5 last:border-b-0"
            >
              <span className="text-xs text-muted-foreground first-letter:uppercase">
                {format.dateTime(toDbDate(session.day), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </span>
              <span className="text-sm tabular-nums">
                {session.sets.map(describe).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
