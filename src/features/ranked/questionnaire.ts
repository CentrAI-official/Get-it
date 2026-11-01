import { z } from "zod";
import {
  COUNTRIES,
  MAX_AGE,
  MIN_AGE,
  SEXES,
  type Country,
} from "@/features/profile/details";

// La personne comparée à la population : l'âge, le sexe et le pays viennent du
// compte (src/features/profile/details.ts), jamais redemandés. Les mesures et
// leurs champs sont dans src/features/levels/factors.ts.

export type RankedCountry = Country;

/** Flexion assise : les doigts dépassent les orteils, ou il manque des centimètres. */
export const REACH_SIDES = ["beyond", "short"] as const;

const integer = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max);

/** Âge, sexe et pays tirés du compte. */
export const rankedPersonSchema = z.object({
  country: z.enum(COUNTRIES),
  age: integer(MIN_AGE, MAX_AGE),
  sex: z.enum(SEXES),
});
export type RankedPerson = z.infer<typeof rankedPersonSchema>;
