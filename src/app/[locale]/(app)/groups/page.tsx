import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.groups");
  return { title: t("title") };
}

// Groupes de la Communauté (lot à venir)
export default function GroupsPage() {
  const t = useTranslations("App.groups");

  return (
    <ComingSoon
      title={t("title")}
      description={t("question")}
      icon={UsersRound}
      soonTitle={t("soonTitle")}
      soonDescription={t("soonDescription")}
    />
  );
}
