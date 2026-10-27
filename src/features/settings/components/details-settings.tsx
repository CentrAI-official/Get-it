import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileDetailsForm } from "@/features/profile/components/profile-details-form";
import { toCalendarDay } from "@/lib/dates";
import { getProfileDetails } from "@/server/profile/details";
import { getCurrentProfile } from "@/server/profile/service";

/** Date de naissance, sexe, pays et région. Lit la session : à placer dans un <Suspense>. */
export async function DetailsSettings() {
  const profile = await getCurrentProfile();
  const [details, t] = await Promise.all([
    getProfileDetails(profile.id),
    getTranslations("Details.settings"),
  ]);
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileDetailsForm initial={details} today={today} mode="settings" />
      </CardContent>
    </Card>
  );
}

export function DetailsSettingsSkeleton() {
  return <Skeleton className="h-96 max-w-2xl rounded-3xl" />;
}
