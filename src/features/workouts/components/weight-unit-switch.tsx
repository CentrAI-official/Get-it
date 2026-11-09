"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { setWeightUnitAction } from "../actions";
import { WEIGHT_UNITS, type WeightUnit } from "../rules";

/**
 * kg ou lb, partout où il y a des poids (fiche d'un exercice) : le même choix
 * que le carnet d'entraînement et le Ranked, gardé dans le compte.
 */
export function WeightUnitSwitch({ unit }: { unit: WeightUnit }) {
  const t = useTranslations("Workouts");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div
      role="radiogroup"
      aria-label={t("unit.label")}
      className={cn(
        "flex w-fit rounded-full bg-foreground/[0.06] p-0.5",
        pending && "opacity-60",
      )}
    >
      {WEIGHT_UNITS.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={unit === value}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (value === unit) return;
              await setWeightUnitAction(value);
              router.refresh();
            })
          }
          className={cn(
            "h-8 min-w-11 rounded-full px-2.5 text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            unit === value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground",
          )}
        >
          {t(`units.${value}`)}
        </button>
      ))}
    </div>
  );
}
