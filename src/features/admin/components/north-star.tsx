import { Star } from "lucide-react";
import { PercentValue } from "@/components/percent-value";
import { Change, IconChip } from "./dashboard-ui";

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Jauge sur les trois quarts du cercle, ouverte en bas. */
const ARC = CIRCUMFERENCE * 0.75;

type NorthStarProps = {
  title: string;
  /** La phrase complète, avec la part (« 67 % des membres actifs… »). */
  caption: string;
  /** Part de 0 à 1 ; null s'il n'y a pas de membres actifs cette semaine. */
  value: number | null;
  change: { value: number; text: string } | null;
  changeLabel: string;
};

/** La carte qui ouvre le dashboard : la métrique étoile, sur une jauge orange. */
export function NorthStarHero({
  title,
  caption,
  value,
  change,
  changeLabel,
}: NorthStarProps) {
  const filled = ARC * Math.max(0, Math.min(1, value ?? 0));

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-primary/20 bg-primary/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex max-w-md flex-col gap-4">
        <IconChip icon={Star} />
        <h2 className="text-2xl leading-tight font-semibold text-balance sm:text-3xl">
          {title}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{caption}</p>
        <Change change={change} label={changeLabel} />
      </div>
      <div
        aria-hidden="true"
        className="relative size-44 shrink-0 self-center sm:size-52"
      >
        <svg viewBox="0 0 120 120" className="size-full -rotate-[225deg]">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
            className="stroke-foreground/8"
          />
          {filled > 0 ? (
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
              className="stroke-primary"
            />
          ) : null}
        </svg>
        <p className="absolute inset-0 flex items-center justify-center font-display text-6xl leading-none sm:text-7xl">
          {value === null ? "—" : <PercentValue part={value} />}
        </p>
      </div>
    </section>
  );
}
