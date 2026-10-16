import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.events");
  return { title: t("title") };
}

// Événements de la Communauté (lot à venir)
export default function EventsPage() {
  const t = useTranslations("App.events");

  return (
    <ComingSoon
      title={t("title")}
      description={t("question")}
      icon={CalendarDays}
      soonTitle={t("soonTitle")}
      soonDescription={t("soonDescription")}
    />
  );
}
