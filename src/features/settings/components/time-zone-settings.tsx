import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentProfile } from "@/server/profile/service";
import { TimeZonePrompt, TimeZoneSelect } from "./time-zone-controls";

/** Réglages › Fuseau horaire. À placer dans un <Suspense>. */
export async function TimeZoneSettings() {
  const [profile, t] = await Promise.all([
    getCurrentProfile(),
    getTranslations("App.settings.timeZone"),
  ]);
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <TimeZoneSelect current={profile.timeZone} />
      </CardContent>
    </Card>
  );
}

export function TimeZoneSettingsSkeleton() {
  return <Skeleton className="h-40 max-w-2xl rounded-3xl" />;
}

/**
 * Dans la mise en page de l'application : propose de changer de fuseau quand
 * le téléphone n'est plus à l'heure du compte. À placer dans un <Suspense>.
 */
export async function TimeZoneCheck() {
  const profile = await getCurrentProfile();
  // Pas avant l'onboarding : le fuseau vient d'être pris à l'inscription
  if (!profile.onboardedAt) return null;
  return <TimeZonePrompt current={profile.timeZone} />;
}
