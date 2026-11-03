"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudOff,
  Minus,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  deleteWorkoutAction,
  reopenWorkoutAction,
  setWeightUnitAction,
  syncWorkoutAction,
} from "../actions";
import {
  addSet,
  afterSync,
  applyWeight,
  buildExercises,
  changeSet,
  changeWeight,
  hasActivity,
  hasPending,
  mergeStored,
  removeLastSet,
  setKey,
  setsOf,
  startDraft,
  syncPayload,
  type LoggerExercise,
  type WorkoutDraft,
} from "../draft";
import {
  DEFAULT_REST_SECONDS,
  FEELINGS,
  findRecords,
  parseWeightText,
  suggestWeight,
  weightFieldText,
  WEIGHT_UNITS,
  workoutMinutes,
  workoutTotals,
  WORKOUT_LIMITS,
  type PastSet,
  type SetLog,
  type WeightUnit,
  type WorkoutError,
  type WorkoutExercise,
  type WorkoutPageData,
} from "../rules";
import { loadDraft, removeDraft, saveDraft } from "../store";
import { useWeightLabel, WorkoutSummary } from "./workout-summary";
import {
  Countdown,
  ElapsedTime,
  useAlarm,
  useWakeLock,
} from "./workout-timers";

/** Envoi au serveur peu après le dernier changement. */
const SYNC_DELAY_MS = 800;
/** Sans réseau : on réessaie (et dès que le réseau revient). */
const RETRY_MS = 15_000;
const REST_STEP_SECONDS = 15;

export type WorkoutTarget = {
  day: string;
  weekday: number;
  title: string;
  items: readonly WorkoutExercise[];
};

type Screen = "unit" | "log" | "finish" | "summary";
type Timer = { endsAt: number; total: number };
type Hold = Timer & { key: string; position: number };

/**
 * Le carnet d'entraînement, en plein écran sur téléphone : un exercice à la
 * fois, ses séries (poids, répétitions, ✓), le repos après chaque ✓, puis le
 * résumé. Chaque changement est gardé sur le téléphone, puis envoyé au serveur
 * dès qu'il y a du réseau : rien n'est perdu si le signal coupe au gym.
 */
export function WorkoutLogger({
  target,
  data,
  today,
  onClose,
  onChanged,
}: {
  target: WorkoutTarget;
  data: WorkoutPageData;
  today: string;
  onClose: () => void;
  /** La séance a changé côté serveur : la page se relit. */
  onChanged: () => void;
}) {
  const t = useTranslations("Workouts");
  const owner = data.ownerId;
  const [saved] = useState(
    () =>
      data.sessions.find(
        (row) => row.day === target.day && row.weekday === target.weekday,
      ) ?? null,
  );
  const [exercises] = useState(() =>
    buildExercises(
      saved && saved.exercises.length > 0 ? saved.exercises : target.items,
      data.history,
    ),
  );
  const [draft, setDraft] = useState<WorkoutDraft>(() =>
    mergeStored(
      startDraft({
        day: target.day,
        weekday: target.weekday,
        now: new Date().toISOString(),
        exercises,
        saved,
      }),
      saved?.finishedAt ? null : loadDraft(owner, target.day, target.weekday),
    ),
  );
  const [unit, setUnit] = useState<WeightUnit | null>(data.unit);
  const [finishedAt, setFinishedAt] = useState(
    () => saved?.finishedAt ?? draft.finish?.finishedAt ?? null,
  );
  const [feeling, setFeeling] = useState<number | null>(
    () => saved?.feeling ?? draft.finish?.feeling ?? null,
  );
  // Les records de la séance enregistrée, tant qu'elle n'est pas refaite
  const [savedRecords, setSavedRecords] = useState(() =>
    saved?.finishedAt ? saved.records : null,
  );
  const [screen, setScreen] = useState<Screen>(() =>
    finishedAt
      ? "summary"
      : data.unit === null &&
          exercises.some((exercise) => exercise.history?.loaded !== false)
        ? "unit"
        : "log",
  );
  const [step, setStep] = useState(() =>
    Math.max(
      0,
      exercises.findIndex((exercise) =>
        setsOf(draft, exercise.position).some((set) => !set.done),
      ),
    ),
  );
  const [rest, setRest] = useState<Timer | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [offline, setOffline] = useState(false);
  const [failure, setFailure] = useState<WorkoutError | null>(null);
  const [retry, setRetry] = useState(0);
  const { prime, ring } = useAlarm();
  useWakeLock();

  const latest = useRef(draft);
  const sending = useRef(false);
  // Séance terminée et reçue, ou supprimée : plus rien à garder sur le téléphone
  const settled = useRef(Boolean(saved?.finishedAt));

  useEffect(() => {
    latest.current = draft;
    if (!settled.current && hasActivity(draft)) saveDraft(owner, draft);
  }, [draft, owner]);

  const send = useCallback(async () => {
    const current = latest.current;
    if (sending.current || !hasPending(current)) return;
    sending.current = true;
    const payload = syncPayload(current);
    try {
      const result = await syncWorkoutAction(payload);
      setOffline(false);
      if (result.ok) {
        setDraft((value) => afterSync(value, payload));
        if (payload.finish) {
          settled.current = true;
          removeDraft(owner, current.day, current.weekday);
          onChanged();
        }
      } else {
        // Refusé par le serveur : réessayer n'y changerait rien
        setFailure(result.error);
        setFinishedAt(null);
        setScreen("log");
        setDraft((value) => ({
          ...value,
          dirty: [],
          removed: [],
          finish: null,
        }));
      }
    } catch {
      setOffline(true);
    } finally {
      sending.current = false;
    }
  }, [onChanged, owner]);

  useEffect(() => {
    if (!hasPending(draft)) return;
    const timer = setTimeout(
      () => void send(),
      draft.finish ? 0 : SYNC_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [draft, retry, send]);

  useEffect(() => {
    const again = () => setRetry((value) => value + 1);
    const timer = setInterval(again, RETRY_MS);
    window.addEventListener("online", again);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", again);
    };
  }, []);

  function close() {
    // Dernier envoi ; sinon le brouillon reste sur le téléphone
    void send().finally(onChanged);
    onClose();
  }

  const planned = exercises.map((exercise) => exercise.prescription.sets);
  const totals = workoutTotals(planned, draft.sets);
  const exercise = exercises[Math.min(step, exercises.length - 1)];
  const shownUnit = unit ?? "kg";

  function startRest(position: number) {
    const seconds =
      exercises[position]?.prescription.restSeconds ?? DEFAULT_REST_SECONDS;
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
  }

  const onRestFinished = useCallback(() => {
    ring();
    setRest(null);
  }, [ring]);

  function toggle(set: SetLog) {
    prime();
    const key = setKey(set);
    if (set.done) {
      setDraft((value) => changeSet(value, key, { done: false }));
      return;
    }
    setHold(null);
    const remaining = draft.sets.some(
      (entry) => !entry.done && setKey(entry) !== key,
    );
    setDraft((value) => changeSet(value, key, { done: true }));
    if (remaining) startRest(set.position);
    else setRest(null);
  }

  function startHold(set: SetLog) {
    prime();
    setRest(null);
    const total = set.seconds ?? 0;
    if (total <= 0) return;
    setHold({
      key: setKey(set),
      position: set.position,
      endsAt: Date.now() + total * 1000,
      total,
    });
  }

  const onHoldFinished = useCallback(() => {
    ring();
    if (!hold) return;
    setDraft((value) =>
      changeSet(value, hold.key, { done: true, seconds: hold.total }),
    );
    const seconds =
      exercises[hold.position]?.prescription.restSeconds ??
      DEFAULT_REST_SECONDS;
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
    setHold(null);
  }, [exercises, hold, ring]);

  function stopHold() {
    if (!hold) return;
    const elapsed = Math.round(
      (Date.now() - (hold.endsAt - hold.total * 1000)) / 1000,
    );
    setDraft((value) =>
      changeSet(value, hold.key, {
        done: true,
        seconds: Math.min(Math.max(elapsed, 1), hold.total),
      }),
    );
    startRest(hold.position);
    setHold(null);
  }

  function chooseUnit(next: WeightUnit) {
    setUnit(next);
    void setWeightUnitAction(next).catch(() => undefined);
    if (screen === "unit") setScreen("log");
  }

  function finish(chosen: number | null) {
    const at = new Date().toISOString();
    setFinishedAt(at);
    setFeeling(chosen);
    setSavedRecords(null);
    setRest(null);
    setHold(null);
    setScreen("summary");
    setDraft((value) => ({
      ...value,
      finish: { finishedAt: at, feeling: chosen },
    }));
  }

  async function continueWorkout() {
    const ok = await reopenWorkoutAction({
      day: target.day,
      weekday: target.weekday,
    });
    if (!ok) return false;
    settled.current = false;
    setFinishedAt(null);
    setFeeling(null);
    setSavedRecords(null);
    setScreen("log");
    onChanged();
    return true;
  }

  async function deleteWorkout() {
    const ok = await deleteWorkoutAction({
      day: target.day,
      weekday: target.weekday,
    });
    if (!ok) return false;
    settled.current = true;
    removeDraft(owner, target.day, target.weekday);
    onChanged();
    onClose();
    return true;
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(52rem,calc(100dvh-4rem))] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 sm:ring-1"
      >
        <DialogTitle className="sr-only">{target.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>

        {screen === "unit" ? (
          <UnitStep onChoose={chooseUnit} />
        ) : screen === "summary" ? (
          <WorkoutSummary
            title={target.title}
            minutes={workoutMinutes(
              draft.startedAt,
              finishedAt ?? draft.startedAt,
            )}
            doneSets={totals.doneSets}
            totalSets={totals.totalSets}
            volumeGrams={totals.volumeGrams}
            records={
              savedRecords ??
              findRecords(
                exercises.map(({ position, name, history }) => ({
                  position,
                  name,
                  previousBest: history?.best ?? null,
                })),
                draft.sets,
              )
            }
            feeling={feeling}
            unit={shownUnit}
            pending={hasPending(draft)}
            offline={offline}
            canContinue={target.day === today}
            onClose={close}
            onContinue={continueWorkout}
            onDelete={deleteWorkout}
          />
        ) : screen === "finish" ? (
          <FinishStep
            doneSets={totals.doneSets}
            totalSets={totals.totalSets}
            onFinish={finish}
            onBack={() => setScreen("log")}
          />
        ) : exercise ? (
          <>
            <div className="mr-10 flex items-center gap-3">
              <span className="font-display text-3xl leading-none text-primary tabular-nums">
                <span className="sr-only">{t("elapsed")} </span>
                <ElapsedTime startedAt={draft.startedAt} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {target.title}
              </span>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => setScreen("finish")}
              >
                {t("finishShort")}
              </Button>
            </div>

            <nav aria-label={t("exercisesLabel")} className="mt-2 flex gap-1.5">
              {exercises.map((entry) => {
                const sets = setsOf(draft, entry.position);
                const complete =
                  sets.length > 0 && sets.every((set) => set.done);
                return (
                  <button
                    key={entry.position}
                    type="button"
                    aria-label={entry.name}
                    aria-current={entry.position === step ? "step" : undefined}
                    onClick={() => setStep(entry.position)}
                    className="flex h-6 flex-1 items-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-full rounded-full",
                        complete
                          ? "bg-primary"
                          : entry.position === step
                            ? "bg-primary/50"
                            : "bg-foreground/10",
                      )}
                    />
                  </button>
                );
              })}
            </nav>

            <ExerciseStep
              // Un champ en cours d'édition ne suit pas d'un exercice à l'autre
              key={exercise.position}
              exercise={exercise}
              current={step + 1}
              total={exercises.length}
              sets={setsOf(draft, exercise.position)}
              unit={shownUnit}
              holding={hold?.key ?? null}
              onUnit={chooseUnit}
              onWeight={(key, grams) =>
                setDraft((value) => changeWeight(value, key, grams))
              }
              onValues={(key, values) =>
                setDraft((value) => changeSet(value, key, values))
              }
              onToggle={toggle}
              onHold={startHold}
              onAdd={() =>
                setDraft((value) => addSet(value, exercise.position))
              }
              onRemove={() =>
                setDraft((value) => removeLastSet(value, exercise.position))
              }
              onSuggestion={(grams) =>
                setDraft((value) =>
                  applyWeight(value, exercise.position, grams),
                )
              }
              onLeave={close}
            />

            <div className="sticky bottom-0 mt-auto flex flex-col gap-3 bg-popover pt-3">
              {failure ? (
                <p role="alert" className="text-sm text-destructive">
                  {t(`errors.${failure}`)}
                </p>
              ) : null}
              {offline ? (
                <p
                  role="status"
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <CloudOff aria-hidden="true" className="size-4 shrink-0" />
                  {t("offline")}
                </p>
              ) : null}
              {hold ? (
                <Countdown
                  endsAt={hold.endsAt}
                  total={hold.total}
                  title={t("hold.title")}
                  onFinished={onHoldFinished}
                >
                  <Button variant="outline" className="h-11" onClick={stopHold}>
                    {t("hold.stop")}
                  </Button>
                </Countdown>
              ) : rest ? (
                <Countdown
                  endsAt={rest.endsAt}
                  total={rest.total}
                  title={t("rest.title")}
                  onFinished={onRestFinished}
                >
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className="size-11"
                    aria-label={t("rest.minus", { seconds: REST_STEP_SECONDS })}
                    onClick={() =>
                      setRest((value) =>
                        value
                          ? {
                              ...value,
                              endsAt: Math.max(
                                Date.now() + 1000,
                                value.endsAt - REST_STEP_SECONDS * 1000,
                              ),
                            }
                          : null,
                      )
                    }
                  >
                    <Minus aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className="size-11"
                    aria-label={t("rest.plus", { seconds: REST_STEP_SECONDS })}
                    onClick={() =>
                      setRest((value) =>
                        value
                          ? {
                              endsAt: value.endsAt + REST_STEP_SECONDS * 1000,
                              total: value.total + REST_STEP_SECONDS,
                            }
                          : null,
                      )
                    }
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => setRest(null)}
                  >
                    {t("rest.skip")}
                  </Button>
                </Countdown>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-12"
                  disabled={step === 0}
                  onClick={() => setStep((value) => value - 1)}
                >
                  <ArrowLeft aria-hidden="true" />
                  {t("previous")}
                </Button>
                {step < exercises.length - 1 ? (
                  <Button
                    size="lg"
                    className="h-12 px-5"
                    onClick={() => setStep((value) => value + 1)}
                  >
                    {t("next")}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="h-12 px-5"
                    onClick={() => setScreen("finish")}
                  >
                    {t("finishShort")}
                    <Check aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Première séance : kilos ou livres. */
function UnitStep({ onChoose }: { onChoose: (unit: WeightUnit) => void }) {
  const t = useTranslations("Workouts.unit");
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-5xl leading-none tracking-wide uppercase">
          {t("title")}
        </h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex flex-col gap-3">
        {WEIGHT_UNITS.map((unit) => (
          <Button
            key={unit}
            size="lg"
            variant="outline"
            className="h-16 text-base"
            onClick={() => onChoose(unit)}
          >
            {t(unit)}
          </Button>
        ))}
      </div>
    </div>
  );
}

const FIELD =
  "h-12 rounded-xl border-0 bg-foreground/[0.06] px-1 text-center text-lg font-semibold tabular-nums md:text-lg";

/** Le poids d'une série : le texte tapé reste tel quel pendant l'édition. */
function WeightField({
  grams,
  unit,
  label,
  onChange,
}: {
  grams: number | null;
  unit: WeightUnit;
  label: string;
  onChange: (grams: number | null) => void;
}) {
  const locale = useLocale();
  const [editing, setEditing] = useState<string | null>(null);
  const shown = editing ?? weightFieldText(grams, unit, locale);
  const invalid =
    editing !== null &&
    editing.trim() !== "" &&
    parseWeightText(editing, unit) === null;
  return (
    <Input
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      placeholder="—"
      value={shown}
      className={FIELD}
      onFocus={(event) => {
        setEditing(shown);
        event.currentTarget.select();
      }}
      onBlur={() => setEditing(null)}
      onChange={(event) => {
        const text = event.target.value;
        setEditing(text);
        if (!text.trim()) onChange(null);
        else {
          const parsed = parseWeightText(text, unit);
          if (parsed !== null) onChange(parsed);
        }
      }}
    />
  );
}

/** Répétitions ou secondes d'une série. */
function CountField({
  value,
  max,
  label,
  onChange,
}: {
  value: number | null;
  max: number;
  label: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      placeholder="—"
      value={value ?? ""}
      className={FIELD}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const text = event.target.value.trim();
        if (!text) onChange(null);
        else if (/^\d+$/.test(text) && Number(text) <= max) {
          onChange(Number(text));
        }
      }}
    />
  );
}

/** Un exercice : l'objectif, la dernière fois, la suggestion et ses séries. */
function ExerciseStep({
  exercise,
  current,
  total,
  sets,
  unit,
  holding,
  onUnit,
  onWeight,
  onValues,
  onToggle,
  onHold,
  onAdd,
  onRemove,
  onSuggestion,
  onLeave,
}: {
  exercise: LoggerExercise;
  current: number;
  total: number;
  sets: SetLog[];
  unit: WeightUnit;
  holding: string | null;
  onUnit: (unit: WeightUnit) => void;
  onWeight: (key: string, grams: number | null) => void;
  onValues: (
    key: string,
    values: Partial<Pick<SetLog, "reps" | "seconds">>,
  ) => void;
  onToggle: (set: SetLog) => void;
  onHold: (set: SetLog) => void;
  onAdd: () => void;
  onRemove: () => void;
  onSuggestion: (grams: number) => void;
  onLeave: () => void;
}) {
  const t = useTranslations("Workouts");
  const weight = useWeightLabel(unit);
  const { prescription, history } = exercise;
  const timed = prescription.seconds !== null;
  const loaded = !timed && history?.loaded !== false;
  const suggestion = suggestWeight(prescription, history, unit);
  const last = history?.last?.sets ?? [];
  const columns = timed
    ? "grid-cols-[2rem_minmax(0,1fr)_3rem_3rem]"
    : loaded
      ? "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_3rem]"
      : "grid-cols-[2rem_minmax(0,1fr)_3rem]";

  function lastLabel(past: readonly PastSet[]) {
    const first = past[0];
    if (!first) return null;
    const same = past.every(
      (set) =>
        set.weightGrams === first.weightGrams &&
        set.reps === first.reps &&
        set.seconds === first.seconds,
    );
    if (same) {
      if (first.seconds) {
        return t("last.sameTime", {
          count: past.length,
          seconds: first.seconds,
        });
      }
      return first.weightGrams
        ? t("last.sameWeight", {
            count: past.length,
            reps: first.reps ?? 0,
            weight: weight(first.weightGrams),
          })
        : t("last.sameReps", { count: past.length, reps: first.reps ?? 0 });
    }
    return t("last.mixed", {
      list: past
        .map((set) =>
          set.seconds
            ? t("last.oneTime", { seconds: set.seconds })
            : set.weightGrams
              ? t("last.oneWeight", {
                  reps: set.reps ?? 0,
                  weight: weight(set.weightGrams),
                })
              : t("last.oneReps", { reps: set.reps ?? 0 }),
        )
        .join(", "),
    });
  }

  return (
    <div className="flex flex-col gap-4 pt-4 pb-4">
      <div className="flex flex-col gap-1.5">
        <span className="caps-label text-muted-foreground">
          {t("step", { current, total })}
        </span>
        <h2 className="font-display text-4xl leading-none tracking-wide text-balance uppercase">
          {exercise.name}
        </h2>
        {exercise.detail ? (
          <p className="text-sm text-muted-foreground">{exercise.detail}</p>
        ) : null}
        {exercise.ref ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-1 w-fit"
            onClick={onLeave}
          >
            <Link href={`/services/library/${exercise.ref}`}>
              <Play aria-hidden="true" />
              {t("demo")}
            </Link>
          </Button>
        ) : null}
      </div>

      {last.length > 0 || suggestion !== null ? (
        <div className="flex flex-col gap-2">
          {last.length > 0 ? (
            <p className="text-sm font-medium">{lastLabel(last)}</p>
          ) : null}
          {suggestion !== null ? (
            <button
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="flex w-fit items-center gap-2 rounded-full bg-primary/15 px-3 py-2 text-sm font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Sparkles aria-hidden="true" className="size-4" />
              {t("suggestion", { weight: weight(suggestion) })}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div
          aria-hidden="true"
          className={cn(
            "grid items-center gap-2 px-1 text-xs text-muted-foreground",
            columns,
          )}
        >
          <span className="text-center">{t("table.set")}</span>
          {loaded ? (
            <span className="text-center">
              {t("table.weight", { unit: t(`units.${unit}`) })}
            </span>
          ) : null}
          <span className="text-center">
            {timed ? t("table.seconds") : t("table.reps")}
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {sets.map((set) => {
            const key = setKey(set);
            const n = set.setNumber;
            return (
              <li
                key={key}
                className={cn(
                  "grid items-center gap-2 rounded-2xl p-1",
                  columns,
                  set.done && "bg-primary/10",
                )}
              >
                <span className="text-center font-display text-xl tabular-nums">
                  {n}
                </span>
                {loaded ? (
                  <WeightField
                    grams={set.weightGrams}
                    unit={unit}
                    label={t("table.weightLabel", { n })}
                    onChange={(grams) => onWeight(key, grams)}
                  />
                ) : null}
                {timed ? (
                  <CountField
                    value={set.seconds}
                    max={WORKOUT_LIMITS.seconds}
                    label={t("table.secondsLabel", { n })}
                    onChange={(seconds) => onValues(key, { seconds })}
                  />
                ) : (
                  <CountField
                    value={set.reps}
                    max={WORKOUT_LIMITS.reps}
                    label={t("table.repsLabel", { n })}
                    onChange={(reps) => onValues(key, { reps })}
                  />
                )}
                {timed ? (
                  <button
                    type="button"
                    aria-label={t("table.startHold", { n })}
                    disabled={set.done || holding !== null}
                    onClick={() => onHold(set)}
                    className="flex size-12 items-center justify-center rounded-xl bg-foreground/[0.06] text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
                  >
                    <Play aria-hidden="true" className="size-5 fill-current" />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-pressed={set.done}
                  aria-label={t("table.check", { n })}
                  onClick={() => onToggle(set)}
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    set.done
                      ? "bg-primary text-primary-foreground"
                      : "border border-foreground/15 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className="size-6"
                    strokeWidth={3}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <Button
            variant="ghost"
            className="h-11"
            disabled={sets.length >= WORKOUT_LIMITS.sets}
            onClick={onAdd}
          >
            <Plus aria-hidden="true" />
            {t("addSet")}
          </Button>
          {sets.length > 1 && !sets.at(-1)?.done ? (
            <Button
              variant="ghost"
              className="h-11 text-muted-foreground"
              onClick={onRemove}
            >
              <Minus aria-hidden="true" />
              {t("removeSet")}
            </Button>
          ) : null}
        </div>
        {loaded ? (
          <div
            role="group"
            aria-label={t("unit.label")}
            className="flex gap-0.5 rounded-full bg-foreground/5 p-0.5"
          >
            {WEIGHT_UNITS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={unit === value}
                onClick={() => onUnit(value)}
                className={cn(
                  "h-8 min-w-11 rounded-full px-2.5 text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  unit === value
                    ? "bg-foreground/12 text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {t(`units.${value}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Avant de terminer : les séries faites et le ressenti, facultatif. */
function FinishStep({
  doneSets,
  totalSets,
  onFinish,
  onBack,
}: {
  doneSets: number;
  totalSets: number;
  onFinish: (feeling: number | null) => void;
  onBack: () => void;
}) {
  const t = useTranslations("Workouts");
  const [feeling, setFeeling] = useState<number | null>(null);
  return (
    <div className="flex flex-1 flex-col gap-6 pt-10">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-5xl leading-none tracking-wide uppercase">
          {t("finish.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("finish.done", { done: doneSets, total: totalSets })}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <span id="workout-feeling" className="font-medium">
          {t("finish.feeling")}
        </span>
        <div
          role="group"
          aria-labelledby="workout-feeling"
          className="flex flex-wrap gap-2"
        >
          {FEELINGS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={feeling === value}
              onClick={() =>
                setFeeling((current) => (current === value ? null : value))
              }
              className={cn(
                "h-11 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                feeling === value
                  ? "border-primary bg-primary/15"
                  : "border-foreground/10 text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`feelings.${value}`)}
            </button>
          ))}
        </div>
      </div>
      {doneSets === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("finish.noSet")}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2">
        <Button
          size="lg"
          className="h-14 text-base"
          disabled={doneSets === 0}
          onClick={() => onFinish(feeling)}
        >
          <Check aria-hidden="true" />
          {t("finish.confirm")}
        </Button>
        <Button variant="ghost" size="lg" className="h-12" onClick={onBack}>
          {t("finish.back")}
        </Button>
      </div>
    </div>
  );
}
