import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showsPresence } from "@/server/presence/service";
import { getCurrentProfile } from "@/server/profile/service";
import { PresenceToggle } from "./presence-toggle";

/** Présence en ligne dans les Réglages. À placer dans un <Suspense>. */
export async function PresenceSettings() {
  const profile = await getCurrentProfile();
  const [t, shown] = await Promise.all([
    getTranslations("App.settings.presence"),
    showsPresence(profile.id),
  ]);
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <PresenceToggle shown={shown} />
      </CardContent>
    </Card>
  );
}

export function PresenceSettingsSkeleton() {
  return <Skeleton className="h-36 max-w-2xl rounded-3xl" />;
}
