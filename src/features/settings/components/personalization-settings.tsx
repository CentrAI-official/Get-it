import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { personalizationEnabled } from "@/server/analytics/personalization";
import { getCurrentProfile } from "@/server/profile/service";
import { PersonalizationToggle } from "./personalization-toggle";

/** Mesure d'audience et personnalisation dans les Réglages. À placer dans un <Suspense>. */
export async function PersonalizationSettings() {
  const profile = await getCurrentProfile();
  const [t, enabled] = await Promise.all([
    getTranslations("App.settings.personalization"),
    personalizationEnabled(profile.id),
  ]);
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("never")}</p>
        <PersonalizationToggle enabled={enabled} />
      </CardContent>
    </Card>
  );
}

export function PersonalizationSettingsSkeleton() {
  return <Skeleton className="h-48 max-w-2xl rounded-3xl" />;
}
