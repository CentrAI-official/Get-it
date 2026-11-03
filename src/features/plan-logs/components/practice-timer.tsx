"use client";

import { Minus, Play, Plus, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Countdown,
  useAlarm,
  useWakeLock,
} from "@/features/workouts/components/workout-timers";
import {
  breathAt,
  breathLabel,
  DEFAULT_BREATH_MINUTES,
  DEFAULT_PRACTICE_MINUTES,
  PRACTICE_MINUTES_MAX,
  type BreathPattern,
} from "../rules";

/** Le cercle qui se gonfle et se vide au rythme de la respiration. */
function BreathingCircle({
  pattern,
  startedAt,
}: {
  pattern: BreathPattern;
  startedAt: number;
}) {
  const t = useTranslations("Development.plan.runner.breath");
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  const { phase, left, fill } = breathAt(pattern, (now - startedAt) / 1000);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative flex size-52 items-center justify-center">
        {/* Avec « réduire les animations », le cercle ne bouge plus : le mot et le compte suffisent */}
        <span
          aria-hidden="true"
          style={{ "--breath": 0.55 + fill * 0.45 } as CSSProperties}
          className="absolute inset-0 scale-[var(--breath)] rounded-full bg-primary/20 ring-2 ring-primary transition-[scale] duration-100 ease-linear motion-reduce:scale-100 motion-reduce:transition-none"
        />
        <span className="relative flex flex-col items-center">
          <span
            aria-live="polite"
            className="font-display text-3xl tracking-wide uppercase"
          >
            {t(phase)}
          </span>
          <span
            aria-hidden="true"
            className="font-display text-5xl leading-none text-primary tabular-nums"
          >
            {left}
          </span>
        </span>
      </div>
    </div>
  );
}

function Running({
  seconds,
  pattern,
  onStop,
  onFinished,
}: {
  seconds: number;
  pattern: BreathPattern | null;
  onStop: () => void;
  onFinished: () => void;
}) {
  const t = useTranslations("Development.plan.runner.timer");
  // L'écran reste allumé pendant la pratique
  useWakeLock();
  const [startedAt] = useState(() => Date.now());
  return (
    <div className="flex flex-col gap-3">
      {pattern ? (
        <BreathingCircle pattern={pattern} startedAt={startedAt} />
      ) : null}
      <Countdown
        endsAt={startedAt + seconds * 1000}
        total={seconds}
        title={t("title")}
        onFinished={onFinished}
      >
        <Button
          variant="outline"
          className="h-11"
          onClick={onStop}
          aria-label={t("stop")}
        >
          <Square aria-hidden="true" />
        </Button>
      </Countdown>
    </div>
  );
}

/**
 * Le minuteur d'une pratique mentale : sa durée (que l'on peut changer), et le
 * cercle animé pour une respiration. Il ne coche rien : « puis ✓ » reste un geste.
 */
export function PracticeTimer({
  minutes,
  pattern,
}: {
  /** Durée écrite dans le plan ou dans sa fiche ; null sinon. */
  minutes: number | null;
  pattern: BreathPattern | null;
}) {
  const t = useTranslations("Development.plan.runner.timer");
  const tBreath = useTranslations("Development.plan.runner.breath");
  const { prime, ring } = useAlarm();
  const [chosen, setChosen] = useState(
    minutes ?? (pattern ? DEFAULT_BREATH_MINUTES : DEFAULT_PRACTICE_MINUTES),
  );
  const [state, setState] = useState<"idle" | "running" | "finished">("idle");
  const stop = useCallback(() => setState("idle"), []);
  const finish = useCallback(() => {
    ring();
    setState("finished");
  }, [ring]);

  return (
    <div className="flex flex-col gap-3">
      {state === "running" ? (
        <Running
          seconds={chosen * 60}
          pattern={pattern}
          onStop={stop}
          onFinished={finish}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-3xl bg-raised p-4 ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="caps-label text-muted-foreground">
                {pattern
                  ? tBreath("pattern", { pattern: breathLabel(pattern) })
                  : t("title")}
              </span>
              <span className="font-display text-4xl leading-none tracking-wide uppercase tabular-nums">
                {t("minutes", { count: chosen })}
              </span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <Button
                variant="outline"
                className="size-11"
                aria-label={t("less")}
                disabled={chosen <= 1}
                onClick={() => setChosen((value) => value - 1)}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                className="size-11"
                aria-label={t("more")}
                disabled={chosen >= PRACTICE_MINUTES_MAX}
                onClick={() => setChosen((value) => value + 1)}
              >
                <Plus aria-hidden="true" />
              </Button>
            </span>
          </div>
          {state === "finished" ? (
            <p role="status" className="text-sm font-semibold text-primary">
              {t("finished")}
            </p>
          ) : null}
          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => {
              // Le son n'est permis qu'après un geste
              prime();
              setState("running");
            }}
          >
            <Play aria-hidden="true" className="fill-current" />
            {state === "finished" ? t("restart") : t("start")}
          </Button>
        </div>
      )}
      {pattern ? (
        <p className="text-xs text-muted-foreground">{tBreath("safety")}</p>
      ) : null}
    </div>
  );
}
