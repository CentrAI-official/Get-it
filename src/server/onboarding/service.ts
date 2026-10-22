import "server-only";
import type { OnboardingInput } from "@/features/onboarding/schemas";
import { db } from "@/server/db";
import { markDayPanelSeen } from "@/server/day/service";

/**
 * Enregistre les réponses de l'onboarding : profil, temps quotidien, premiers
 * objectifs et point de départ de chaque pilier. `input` doit avoir été validé
 * par `onboardingSchema` et `userId` venir de la session.
 */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
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
    await tx.pillarAssessment.createMany({
      data: input.pillars.flatMap((pillar) => {
        const score = input.assessments[pillar];
        return score ? [{ userId, pillar, score }] : [];
      }),
    });
  });
  // Le jour de l'inscription, « Ma journée » ne s'ouvre pas tout seul
  await markDayPanelSeen(userId);
}
