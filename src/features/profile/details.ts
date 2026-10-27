import { z } from "zod";
import { REGIONS } from "@/features/marketplace/rules";

// Renseignements personnels demandés à la création du compte (date de
// naissance, sexe à la naissance, pays, province ou État, région du Québec).
// Privés : jamais montrés aux autres membres. Ils servent au mode Ranked
// (comparaison par âge et par sexe) et plus tard aux services près de chez soi.
// Les mêmes limites sont garanties en base (migration « profile_details »).

/** Âge minimum pour utiliser Get iT. */
export const MIN_AGE = 16;
export const MAX_AGE = 110;

/** Sexe à la naissance : deux choix (décision du fondateur). */
export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];

/** Get iT est offert au Canada et aux États-Unis. */
export const COUNTRIES = ["CA", "US"] as const;
export type Country = (typeof COUNTRIES)[number];

/** Provinces et territoires, États (codes postaux officiels, uniques entre les deux pays). */
export const PROVINCES = {
  CA: [
    "AB",
    "BC",
    "MB",
    "NB",
    "NL",
    "NS",
    "NT",
    "NU",
    "ON",
    "PE",
    "QC",
    "SK",
    "YT",
  ],
  US: [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ],
} as const satisfies Record<Country, readonly string[]>;
const province = z.enum([...PROVINCES.CA, ...PROVINCES.US], {
  error: "provinceRequired",
});
export type Province = z.infer<typeof province>;

/** Régions administratives du Québec : les mêmes que le Marketplace. */
const qcRegion = z.enum(REGIONS).exclude(["online"]);
export const QC_REGIONS = qcRegion.options;
export type QcRegion = (typeof QC_REGIONS)[number];

/** Âge en années révolues le jour `today` (« AAAA-MM-JJ », dans le fuseau de la personne). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return Number.NaN;
  const hadBirthday = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthday ? 0 : 1);
}

export const PROFILE_DETAIL_ERRORS = [
  "birthDateInvalid",
  "tooYoung",
  "sexRequired",
  "countryRequired",
  "provinceRequired",
  "qcRegionRequired",
] as const;
export type ProfileDetailError = (typeof PROFILE_DETAIL_ERRORS)[number];

/**
 * Validation des renseignements, le jour `today` : 16 ans et plus, province ou
 * État du bon pays, région du Québec seulement (et obligatoire) au Québec.
 */
export function profileDetailsSchema(today: string) {
  return (
    z
      .object({
        birthDate: z.iso
          .date({ error: "birthDateInvalid" })
          .refine((value) => value >= "1900-01-01" && value <= today, {
            error: "birthDateInvalid",
          })
          .refine((value) => ageOn(value, today) <= MAX_AGE, {
            error: "birthDateInvalid",
          })
          .refine((value) => ageOn(value, today) >= MIN_AGE, {
            error: "tooYoung",
          }),
        sex: z.enum(SEXES, { error: "sexRequired" }),
        country: z.enum(COUNTRIES, { error: "countryRequired" }),
        province,
        qcRegion: qcRegion.nullable().catch(null),
      })
      .superRefine((data, ctx) => {
        const provinces: readonly string[] = PROVINCES[data.country];
        if (!provinces.includes(data.province)) {
          ctx.addIssue({
            code: "custom",
            path: ["province"],
            message: "provinceRequired",
          });
        }
        if (data.province === "QC" && !data.qcRegion) {
          ctx.addIssue({
            code: "custom",
            path: ["qcRegion"],
            message: "qcRegionRequired",
          });
        }
      })
      // Hors du Québec, aucune région n'est gardée
      .transform((data) => ({
        ...data,
        qcRegion: data.province === "QC" ? data.qcRegion : null,
      }))
  );
}

export type ProfileDetails = z.output<ReturnType<typeof profileDetailsSchema>>;

/** Saisie en cours (formulaire) : tout peut encore manquer. */
export type ProfileDetailsDraft = {
  birthDate: string;
  sex: Sex | null;
  country: Country | null;
  province: Province | null;
  qcRegion: QcRegion | null;
};

export const EMPTY_PROFILE_DETAILS: ProfileDetailsDraft = {
  birthDate: "",
  sex: null,
  country: null,
  province: null,
  qcRegion: null,
};

/** Première erreur de chaque champ (clés de `Profile.details.errors`). */
export function detailErrors(
  error: z.ZodError,
): Partial<Record<keyof ProfileDetailsDraft, ProfileDetailError>> {
  const result: Partial<Record<keyof ProfileDetailsDraft, ProfileDetailError>> =
    {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      (field === "birthDate" ||
        field === "sex" ||
        field === "country" ||
        field === "province" ||
        field === "qcRegion") &&
      !result[field]
    ) {
      result[field] =
        PROFILE_DETAIL_ERRORS.find((key) => key === issue.message) ??
        "birthDateInvalid";
    }
  }
  return result;
}
