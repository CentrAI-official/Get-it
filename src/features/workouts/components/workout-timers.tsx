"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatElapsed } from "../rules";

/**
 * L'écran reste allumé pendant la séance (sinon il faut le rallumer à chaque
 * série). Pas pris en charge partout : sans lui, rien ne change.
 */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    async function acquire() {
      try {
        const next = await navigator.wakeLock?.request("screen");
        if (stopped) void next?.release();
        else lock = next ?? null;
      } catch {
        lock = null;
      }
    }
    // Le système relâche le verrou quand la page est cachée
    function onVisible() {
      if (document.visibilityState === "visible") void acquire();
    }
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

/**
 * Le signal de fin d'un minuteur : un son et une vibration (Android seulement).
 * Le navigateur n'autorise le son qu'après un geste : `prime` se fait au toucher.
 */
export function useAlarm() {
  const audio = useRef<AudioContext | null>(null);

  const prime = useCallback(() => {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {
      audio.current = null;
    }
  }, []);

  const ring = useCallback(() => {
    navigator.vibrate?.([200, 100, 200]);
    const context = audio.current;
    if (!context) return;
    try {
      for (const offset of [0, 0.25]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.value = 0.2;
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + 0.15);
      }
    } catch {
      // Le son reste un bonus
    }
  }, []);

  useEffect(() => {
    return () => {
      void audio.current?.close().catch(() => undefined);
      audio.current = null;
    };
  }, []);

  return { prime, ring };
}

/** Temps écoulé depuis le début de la séance. */
export function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{formatElapsed((now - new Date(startedAt).getTime()) / 1000)}</>;
}

/** Un compte à rebours en bas de l'écran : le repos, ou un exercice chronométré. */
export function Countdown({
  endsAt,
  total,
  title,
  onFinished,
  children,
}: {
  /** Fin, en millisecondes. */
  endsAt: number;
  /** Durée totale en secondes, pour la barre. */
  total: number;
  title: string;
  onFinished: () => void;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let finished = false;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt && !finished) {
        finished = true;
        onFinished();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [endsAt, onFinished]);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <div
      role="timer"
      aria-label={title}
      className="flex flex-col gap-3 rounded-3xl bg-raised p-4 ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="caps-label text-muted-foreground">{title}</span>
          <span className="font-display text-5xl leading-none text-primary tabular-nums">
            {formatElapsed(remaining)}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      </div>
      <div aria-hidden="true" className="h-1.5 rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear"
          style={{
            width: `${Math.min(100, (remaining / Math.max(total, 1)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
