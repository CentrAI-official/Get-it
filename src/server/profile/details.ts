import "server-only";
import type {
  Country,
  ProfileDetails,
  ProfileDetailsDraft,
  Province,
  QcRegion,
  Sex,
} from "@/features/profile/details";
import { ageOn, PROVINCES, QC_REGIONS } from "@/features/profile/details";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Renseignements personnels du compte (date de naissance, sexe, pays, région).
// Privés : seule la personne elle-même les lit ; ils ne sont jamais renvoyés
// aux autres membres ni affichés publiquement.

type Row = {
  birthDate: Date | null;
  sex: Sex | null;
  country: Country | null;
  province: string | null;
  qcRegion: string | null;
};

/** Ligne de la base → saisie du formulaire (valeurs inconnues ignorées). */
export function toDetailsDraft(row: Row): ProfileDetailsDraft {
  const provinces: readonly string[] = row.country
    ? PROVINCES[row.country]
    : [];
  return {
    birthDate: row.birthDate ? fromDbDate(row.birthDate) : "",
    sex: row.sex,
    country: row.country,
    province:
      [...PROVINCES.CA, ...PROVINCES.US].find(
        (code: Province) => code === row.province && provinces.includes(code),
      ) ?? null,
    qcRegion:
      QC_REGIONS.find((region: QcRegion) => region === row.qcRegion) ?? null,
  };
}

/** Vrai si les renseignements demandés à la création du compte sont remplis. */
export function detailsComplete(draft: ProfileDetailsDraft) {
  return Boolean(
    draft.birthDate &&
    draft.sex &&
    draft.country &&
    draft.province &&
    (draft.province !== "QC" || draft.qcRegion),
  );
}

export const detailsSelect = {
  birthDate: true,
  sex: true,
  country: true,
  province: true,
  qcRegion: true,
} as const;

/** Renseignements de la personne connectée. */
export async function getProfileDetails(userId: string) {
  const row = await db.profile.findUnique({
    where: { id: userId },
    select: detailsSelect,
  });
  return toDetailsDraft(
    row ?? {
      birthDate: null,
      sex: null,
      country: null,
      province: null,
      qcRegion: null,
    },
  );
}

/** Enregistre des renseignements déjà validés par `profileDetailsSchema`. */
export async function saveProfileDetails(
  userId: string,
  details: ProfileDetails,
) {
  await db.profile.update({
    where: { id: userId },
    data: {
      birthDate: toDbDate(details.birthDate),
      sex: details.sex,
      country: details.country,
      province: details.province,
      qcRegion: details.qcRegion,
    },
  });
}

/** Âge, sexe et pays pour le mode Ranked ; null s'il manque quelque chose. */
export async function getRankedPerson(userId: string, timeZone: string) {
  const row = await db.profile.findUnique({
    where: { id: userId },
    select: { birthDate: true, sex: true, country: true },
  });
  if (!row?.birthDate || !row.sex || !row.country) return null;
  const today = toCalendarDay(new Date(), timeZone);
  return {
    age: ageOn(fromDbDate(row.birthDate), today),
    sex: row.sex,
    country: row.country,
  };
}
