import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
          <CardTitle id="language-settings-title">
            {t("language.title")}
          </CardTitle>
          <CardDescription>{t("language.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSettings labelledBy="language-settings-title" />
        </CardContent>
      </Card>
    </div>
  );
}
