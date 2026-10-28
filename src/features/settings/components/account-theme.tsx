import { useId } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ThemePreference } from "@/config/theme";
import { getCurrentProfile } from "@/server/profile/service";
import { ThemeSettings } from "./theme-settings";
import { ThemeSync } from "./theme-sync";

/** Réglages › Thème : le choix enregistré dans le compte. */
export async function AccountThemeSettings() {
  const profile = await getCurrentProfile();
  return <ThemeCard theme={profile.theme} />;
}

function ThemeCard({ theme }: { theme: ThemePreference }) {
  const t = useTranslations("App.settings.theme");
  const titleId = useId();
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle id={titleId}>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ThemeSettings labelledBy={titleId} initial={theme} />
      </CardContent>
    </Card>
  );
}

export function AccountThemeSettingsSkeleton() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
      </CardContent>
    </Card>
  );
}

/** Mise en page de l'application : applique ici le thème choisi sur un autre appareil. */
export async function AccountThemeSync() {
  const profile = await getCurrentProfile();
  return <ThemeSync theme={profile.theme} />;
}
