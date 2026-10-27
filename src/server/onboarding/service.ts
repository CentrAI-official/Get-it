import "server-only";
import type { OnboardingInput } from "@/features/onboarding/schemas";
import type { ProfileDetails } from "@/features/profile/details";
import { toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { markDayPanelSeen } from "@/server/day/service";

/**
 * Enregistre les réponses de l'onboarding : profil, renseignements du compte
 * (privés), temps quotidien et premiers objectifs. `input` et `details` doivent
 * avoir été validés (`onboardingSchema`, `profileDetailsSchema`) et `userId`
 * venir de la session.
 */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
  details: ProfileDetails,
) {
  await db.$transaction(async (tx) => {
    // Une seule fois : un double envoi ne crée pas d'objectifs en double
    const { count } = await tx.profile.updateMany({
      where: { id: userId, onboardedAt: null },
      data: {
        accountType: input.accountType,
        displayName: input.displayName,
        occupation: input.occupation,
        focusPillars: input.pillars,
        birthDate: toDbDate(details.birthDate),
        sex: details.sex,
        country: details.country,
        province: details.province,
        qcRegion: details.qcRegion,
        onboardedAt: new Date(),
      },
    });
    if (count === 0) return;

    await tx.userSettings.upsert({
      where: { userId },
      update: { dailyMinutes: input.dailyMinutes },
      create: { userId, dailyMinutes: input.dailyMinutes },
    });
    await tx.goal.createMany({
      data: input.goals.map((goal) => ({ userId, ...goal })),
    });
  });
  // Le jour de l'inscription, « Ma journée » ne s'ouvre pas tout seul
  await markDayPanelSeen(userId);
}
