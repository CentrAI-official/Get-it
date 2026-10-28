import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import {
  CommunitySettings,
  CommunitySettingsSkeleton,
} from "@/features/community/components/community-settings";
import { AccountEmail } from "@/features/settings/components/account-email";
import {
  AccountThemeSettings,
  AccountThemeSettingsSkeleton,
} from "@/features/settings/components/account-theme";
import {
  AccountTypeSettings,
  AccountTypeSettingsSkeleton,
} from "@/features/settings/components/account-type-settings";
import {
  AiSettings,
  AiSettingsSkeleton,
} from "@/features/settings/components/ai-settings";
import { DeleteAccountDialog } from "@/features/settings/components/delete-account-dialog";
import {
  DetailsSettings,
  DetailsSettingsSkeleton,
} from "@/features/settings/components/details-settings";
import { PushSettingsCard } from "@/features/notifications/components/push-settings-card";
import { LanguageSettings } from "@/features/settings/components/language-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.settings");
  return { title: t("title") };
}

export default function SettingsPage() {
  const t = useTranslations("App.settings");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("question")} />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("account.title")}</CardTitle>
          <CardDescription>{t("account.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Suspense
            fallback={
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-56 max-w-full" />
              </div>
            }
          >
            <AccountEmail />
          </Suspense>
          <SignOutButton />
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle id="language-settings-title">
            {t("language.title")}
          </CardTitle>
          <CardDescription>{t("language.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSettings labelledBy="language-settings-title" />
        </CardContent>
      </Card>
      <Suspense fallback={<AccountThemeSettingsSkeleton />}>
        <AccountThemeSettings />
      </Suspense>
      <PushSettingsCard />
      <Suspense fallback={<DetailsSettingsSkeleton />}>
        <DetailsSettings />
      </Suspense>
      <Suspense fallback={<AccountTypeSettingsSkeleton />}>
        <AccountTypeSettings />
      </Suspense>
      <Suspense fallback={<AiSettingsSkeleton />}>
        <AiSettings />
      </Suspense>
      <Suspense fallback={<CommunitySettingsSkeleton />}>
        <CommunitySettings />
      </Suspense>
      <Card className="max-w-2xl border-destructive/30!">
        <CardHeader>
          <CardTitle>{t("deleteAccount.title")}</CardTitle>
          <CardDescription>{t("deleteAccount.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
