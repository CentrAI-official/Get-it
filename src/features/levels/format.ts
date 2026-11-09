import type { createFormatter } from "next-intl";
import type { Country, Sex } from "@/features/profile/details";
import type { WeightUnit } from "@/features/workouts/rules";
import { fromKilograms, type LevelFactor } from "./factors";

// Affichage des mesures et des objectifs de niveau, partagé par le serveur
// (titre enregistré de l'objectif) et les écrans. Les libellés vivent dans
// Levels.goals (fr, en).

/** Le formateur de next-intl (useFormatter, getFormatter). */
type NumberFormatter = Pick<ReturnType<typeof createFormatter>, "number">;
/** Traducteur de next-intl, sur l'espace de noms Levels.goals. */
type GoalTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type FormatContext = {
  country: Country;
  sex: Sex;
  /** Poids du corps de la dernière mesure du développé couché, s'il y en a une. */
  weightKg: number | null;
  /** Unité des poids (préférence du carnet d'entraînement). */
  weightUnit: WeightUnit;
};

const currencyOf = (country: Country) => (country === "US" ? "USD" : "CAD");

const money = (
  format: NumberFormatter,
  country: Country,
  value: number,
  cents = false,
) =>
  format.number(value, {
    style: "currency",
    currency: currencyOf(country),
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

/** Une valeur dans son unité : « 2 450 m », « 34 », « +3 cm », « 0,95 × », « 31,50 $ », « 18 % ». */
export function formatFactorValue(
  format: NumberFormatter,
  factor: LevelFactor,
  value: number,
  { country }: Pick<FormatContext, "country">,
): string {
  switch (factor) {
    case "run":
      return `${format.number(value)} m`;
    case "pushUps":
    case "squats":
      return format.number(value);
    case "reach":
      return `${value > 0 ? "+" : value < 0 ? "−" : ""}${format.number(Math.abs(value))} cm`;
    case "jump":
      return `${format.number(value)} cm`;
    case "bench":
      return `${format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ×`;
    case "hourly":
      return money(format, country, value, true);
    case "netWorth":
      return money(format, country, value);
    case "savings":
      return format.number(value, { style: "percent" });
  }
}

/** Titre d'un objectif de niveau : la valeur fixe à atteindre (« Faire 34 pompes d'affilée »). */
export function levelGoalTitle(
  t: GoalTranslator,
  format: NumberFormatter,
  factor: LevelFactor,
  target: number,
  context: FormatContext,
): string {
  const n = (value: number) => format.number(value);
  switch (factor) {
    case "run":
      return t("run", { meters: n(target) });
    case "pushUps":
      // Normes féminines de la SCPE : pompes sur les genoux
      return t(context.sex === "female" ? "pushUpsKnees" : "pushUps", {
        count: n(target),
      });
    case "reach":
      return target > 0
        ? t("reachBeyond", { cm: n(target) })
        : target < 0
          ? t("reachShort", { cm: n(-target) })
          : t("reachToes");
    case "squats":
      return t("squats", { count: n(target) });
    case "jump":
      return t("jump", { cm: n(target) });
    case "bench": {
      const ratio = format.number(target, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (!context.weightKg) return t("benchRatio", { ratio });
      // Arrondi vers le haut à ce qu'on peut charger : 2,5 kg ou 5 lb
      const step = context.weightUnit === "kg" ? 2.5 : 5;
      const load =
        Math.ceil(
          fromKilograms(target * context.weightKg, context.weightUnit) / step,
        ) * step;
      return t("bench", {
        load: `${format.number(load)} ${context.weightUnit}`,
        ratio,
      });
    }
    case "hourly":
      return t("hourly", {
        amount: money(format, context.country, target, true),
      });
    case "netWorth":
      return t("netWorth", { amount: money(format, context.country, target) });
    case "savings":
      return t("savings", {
        percent: format.number(target, { style: "percent" }),
      });
  }
}
