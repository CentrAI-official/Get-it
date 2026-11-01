import "server-only";
import { db } from "@/server/db";

// « Personnaliser mon expérience » (Réglages) : l'analyse des intérêts d'une
// personne est du profilage au sens de la Loi 25 (art. 8.1) ; elle est
// désactivée par défaut et ne vaut qu'avec cet accord. La mesure d'audience
// d'ensemble (temps par section) ne dépend pas de ce réglage.

export async function personalizationEnabled(userId: string) {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { personalizationConsentAt: true },
  });
  return settings?.personalizationConsentAt != null;
}

export async function setPersonalization(userId: string, enabled: boolean) {
  await db.userSettings.updateMany({
    where: { userId },
    data: { personalizationConsentAt: enabled ? new Date() : null },
  });
}
