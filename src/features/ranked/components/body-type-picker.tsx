"use client";

import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { Sex } from "@/features/profile/details";
import { cn } from "@/lib/utils";
import { BODY_TYPES, type BodyType } from "../questionnaire";

/** Proportions de chaque silhouette (demi-largeurs), et épaisseur des bras et des jambes. */
type Shape = {
  shoulders: number;
  chest: number;
  waist: number;
  hips: number;
  arm: number;
  leg: number;
};

const SHAPES: Record<Sex, Record<BodyType, Shape>> = {
  male: {
    ectomorph: {
      shoulders: 9.5,
      chest: 8,
      waist: 7,
      hips: 7.5,
      arm: 3.4,
      leg: 4.4,
    },
    mesomorph: {
      shoulders: 14.5,
      chest: 12.5,
      waist: 8.5,
      hips: 9,
      arm: 5.4,
      leg: 6.2,
    },
    endomorph: {
      shoulders: 12.5,
      chest: 13,
      waist: 14.5,
      hips: 13.5,
      arm: 6,
      leg: 7.4,
    },
  },
  female: {
    ectomorph: {
      shoulders: 8.5,
      chest: 7.5,
      waist: 6.3,
      hips: 8,
      arm: 3.1,
      leg: 4.3,
    },
    mesomorph: {
      shoulders: 11,
      chest: 10.5,
      waist: 7.4,
      hips: 11.5,
      arm: 4.3,
      leg: 5.8,
    },
    endomorph: {
      shoulders: 11,
      chest: 12,
      waist: 12.5,
      hips: 15,
      arm: 5.2,
      leg: 7.4,
    },
  },
};

const CENTER = 30;
const round = (value: number) => Math.round(value * 10) / 10;

/** Silhouette de face, dessinée à partir de ses proportions (décorative). */
function Silhouette({ shape }: { shape: Shape }) {
  const { shoulders: s, chest: ch, waist: w, hips: h, arm: a, leg } = shape;
  const x = (side: 1 | -1, offset: number) => round(CENTER + side * offset);
  const torso = [
    `M ${x(-1, s)} 26`,
    `C ${x(-1, s)} 30 ${x(-1, ch)} 31 ${x(-1, ch)} 35`,
    `C ${x(-1, ch)} 40 ${x(-1, w)} 42 ${x(-1, w)} 47`,
    `C ${x(-1, w)} 52 ${x(-1, h)} 54 ${x(-1, h)} 59`,
    `L ${x(-1, h - 0.5)} 64 L ${x(1, h - 0.5)} 64 L ${x(1, h)} 59`,
    `C ${x(1, h)} 54 ${x(1, w)} 52 ${x(1, w)} 47`,
    `C ${x(1, w)} 42 ${x(1, ch)} 40 ${x(1, ch)} 35`,
    `C ${x(1, ch)} 31 ${x(1, s)} 30 ${x(1, s)} 26`,
    `Q ${x(1, s * 0.5)} 21.5 ${CENTER} 21.5 Q ${x(-1, s * 0.5)} 21.5 ${x(-1, s)} 26 Z`,
  ].join(" ");
  // Bras détachés du corps : un trait épais aux bouts arrondis
  const widest = Math.max(ch, w, h);
  const sides = [-1, 1] as const;

  return (
    <svg
      viewBox="0 0 60 120"
      aria-hidden="true"
      className="h-28 w-auto"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <circle cx={CENTER} cy={11.5} r={6.5} />
      <rect x={CENTER - 2.4} y={16} width={4.8} height={7} rx={2} />
      <path d={torso} />
      {sides.map((side) => (
        <line
          key={`arm${side}`}
          x1={x(side, s - a * 0.35)}
          y1={28}
          x2={x(side, widest + a * 0.5 + 1.8)}
          y2={64}
          strokeWidth={a}
          strokeLinecap="round"
        />
      ))}
      {/* Jambes : larges à la hanche, fines à la cheville */}
      {sides.map((side) => (
        <path
          key={`leg${side}`}
          d={`M ${x(side, 0.9)} 62 L ${x(side, h - 0.4)} 62 L ${x(side, 1.6 + leg * 0.75)} 113 L ${x(side, 1.6)} 113 Z`}
        />
      ))}
    </svg>
  );
}

/**
 * Morphologie en trois silhouettes (ecto, méso, endo), dessinées pour le sexe
 * du compte. Choix contrôlé par le formulaire du mode Ranked.
 */
export function BodyTypePicker({
  sex,
  value,
  onChange,
  labelledBy,
  invalid,
}: {
  sex: Sex;
  value: string;
  onChange: (value: BodyType) => void;
  labelledBy: string;
  invalid: boolean;
}) {
  const t = useTranslations("Ranked.questions.bodyType.options");

  return (
    <RadioGroupPrimitive.Root
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      value={value}
      onValueChange={(next) => {
        const type = BODY_TYPES.find((item) => item === next);
        if (type) onChange(type);
      }}
      className="grid grid-cols-3 gap-2"
    >
      {BODY_TYPES.map((type) => (
        <RadioGroupPrimitive.Item
          key={type}
          value={type}
          className={cn(
            "group flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-2 pt-3 pb-3 text-center transition-colors outline-none hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/10",
          )}
        >
          <span className="text-white/35 transition-colors group-data-checked:text-primary">
            <Silhouette shape={SHAPES[sex][type]} />
          </span>
          <span className="text-sm font-semibold">{t(`${type}.title`)}</span>
          <span className="text-xs leading-snug text-muted-foreground">
            {t(`${type}.description`)}
          </span>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
