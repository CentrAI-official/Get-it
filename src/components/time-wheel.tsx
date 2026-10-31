"use client";

import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// Roulette d'heure, comme le réveil du téléphone : les heures et les minutes
// défilent sans fin au doigt (ou à la molette, ou aux flèches du clavier).
// En anglais, 12 heures avec a.m. / p.m. ; en français, 24 heures.

const ITEM = 56;
/** Copies de la liste dans une roue sans fin (on revient au milieu à l'arrêt). */
const COPIES = 9;
const pad = (value: number) => String(value).padStart(2, "0");
const mod = (value: number, size: number) => ((value % size) + size) % size;

function parseClock(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return { hour: mod(hour, 24), minute: mod(minute, 60) };
}

type TimeWheelProps = {
  /** Heure « HH:MM » (24 h). */
  value: string;
  onChange: (value: string) => void;
  /** Nom accessible du groupe (id de l'étiquette). */
  labelledBy?: string;
  className?: string;
};

export function TimeWheel({
  value,
  onChange,
  labelledBy,
  className,
}: TimeWheelProps) {
  const t = useTranslations("Common.timeWheel");
  const twelve = useLocale() === "en";
  const { hour, minute } = parseClock(value);
  const set = (nextHour: number, nextMinute: number) =>
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`);
  const period = hour >= 12 ? 1 : 0;

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn(
        "relative flex items-center justify-center gap-1",
        className,
      )}
    >
      {/* Bande de l'heure choisie */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-14 -translate-y-1/2 rounded-2xl bg-foreground/[0.06]"
      />
      {twelve ? (
        <WheelColumn
          label={t("hours")}
          values={[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
          value={hour % 12 === 0 ? 12 : hour % 12}
          format={String}
          loop
          onChange={(next) => set((next % 12) + period * 12, minute)}
        />
      ) : (
        <WheelColumn
          label={t("hours")}
          values={Array.from({ length: 24 }, (_, index) => index)}
          value={hour}
          format={String}
          loop
          onChange={(next) => set(next, minute)}
        />
      )}
      <span aria-hidden="true" className="pb-1 text-4xl font-semibold">
        :
      </span>
      <WheelColumn
        label={t("minutes")}
        values={Array.from({ length: 60 }, (_, index) => index)}
        value={minute}
        format={pad}
        loop
        onChange={(next) => set(hour, next)}
      />
      {twelve ? (
        <WheelColumn
          label={t("period")}
          values={[0, 1]}
          value={period}
          format={(next) => (next === 0 ? t("am") : t("pm"))}
          onChange={(next) => set((hour % 12) + next * 12, minute)}
          className="w-24 text-3xl"
        />
      ) : null}
    </div>
  );
}

type WheelColumnProps = {
  label: string;
  values: number[];
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** Roue sans fin (après 59, 00). */
  loop?: boolean;
  className?: string;
};

/** Une roue : la valeur au centre est choisie quand le défilement s'arrête. */
function WheelColumn({
  label,
  values,
  value,
  format,
  onChange,
  loop = false,
  className,
}: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef(0);
  const size = values.length;
  const copies = loop ? COPIES : 1;
  const middle = loop ? Math.floor(COPIES / 2) * size : 0;
  const position = Math.max(0, values.indexOf(value));
  const [center, setCenter] = useState(middle + position);

  // Valeur changée ailleurs (clavier, autre roue, valeur de départ) : la roue s'y place
  // (dépend seulement de la position : défiler ne la change qu'à l'arrêt)
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const shown = Math.round(element.scrollTop / ITEM);
    if (mod(shown, size) === position && element.scrollTop > 0) return;
    element.scrollTop = (middle + position) * ITEM;
    setCenter(middle + position);
  }, [size, middle, position]);

  function onScroll() {
    const element = ref.current;
    if (!element) return;
    setCenter(Math.round(element.scrollTop / ITEM));
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const index = Math.round(element.scrollTop / ITEM);
      const next = values[mod(index, size)];
      // Roue sans fin : retour discret à la copie du milieu
      if (loop && Math.abs(index - (middle + mod(index, size))) > 0) {
        element.scrollTop = (middle + mod(index, size)) * ITEM;
        setCenter(middle + mod(index, size));
      }
      if (next !== undefined && next !== value) onChange(next);
    }, 140);
  }

  function step(delta: number) {
    const index = position + delta;
    const next = loop
      ? values[mod(index, size)]
      : values[Math.min(size - 1, Math.max(0, index))];
    if (next !== undefined && next !== value) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      PageUp: -5,
      PageDown: 5,
    };
    if (event.key in moves) {
      event.preventDefault();
      step(moves[event.key] ?? 0);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? values[0] : values[size - 1];
      if (next !== undefined) onChange(next);
    }
  }

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      aria-valuemin={Math.min(...values)}
      aria-valuemax={Math.max(...values)}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className={cn(
        "relative h-[168px] w-20 snap-y snap-mandatory [scrollbar-width:none] overflow-y-scroll overscroll-contain rounded-2xl text-4xl font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden",
        className,
      )}
      style={{ paddingBlock: ITEM }}
    >
      {Array.from({ length: copies * size }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          onClick={() =>
            ref.current?.scrollTo({ top: index * ITEM, behavior: "smooth" })
          }
          className={cn(
            "flex h-14 cursor-pointer snap-center items-center justify-center transition-colors select-none",
            index === center ? "text-foreground" : "text-foreground/25",
          )}
        >
          {format(values[index % size] ?? 0)}
        </div>
      ))}
    </div>
  );
}
