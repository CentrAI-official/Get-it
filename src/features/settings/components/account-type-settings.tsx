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
import { AccountTypeChoice } from "./account-type-choice";

/** Consommateur ou affilié. Lit la session : à placer dans un <Suspense>. */
export async function AccountTypeSettings() {
  const [profile, t] = await Promise.all([
    getCurrentProfile(),
    getTranslations("App.settings.accountType"),
  ]);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle id="account-type-title">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AccountTypeChoice
          current={profile.accountType}
          labelledBy="account-type-title"
        />
      </CardContent>
    </Card>
  );
}

export function AccountTypeSettingsSkeleton() {
  return <Skeleton className="h-48 max-w-2xl rounded-3xl" />;
}
