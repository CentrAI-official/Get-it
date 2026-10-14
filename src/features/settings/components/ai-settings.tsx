import { getFormatter, getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isAiConfigured } from "@/server/ai/provider";
import { getAiProfile } from "@/server/ai/usage";
import { countCoachConversations } from "@/server/coach/service";
import { getCurrentProfile } from "@/server/profile/service";
import { AiSettingsControls } from "./ai-settings-controls";

/** Get iT AI dans les Réglages : accord (Loi 25) et conversations. À placer dans un <Suspense>. */
export async function AiSettings() {
  const profile = await getCurrentProfile();
  const [t, format, ai, conversations] = await Promise.all([
    getTranslations("App.settings.ai"),
    getFormatter(),
    getAiProfile(profile.id),
    countCoachConversations(profile.id),
  ]);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          {!isAiConfigured()
            ? t("notConfigured")
            : ai?.consentedAt
              ? t("consentedOn", {
                  date: format.dateTime(ai.consentedAt, {
                    dateStyle: "long",
                    timeZone: profile.timeZone,
                  }),
                })
              : t("noConsent")}
        </p>
        <AiSettingsControls
          consented={Boolean(ai?.consented)}
          conversations={conversations}
        />
      </CardContent>
    </Card>
  );
}

export function AiSettingsSkeleton() {
  return <Skeleton className="h-48 max-w-2xl rounded-3xl" />;
}
