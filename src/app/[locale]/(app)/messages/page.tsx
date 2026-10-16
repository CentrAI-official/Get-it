import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.messages");
  return { title: t("title") };
}

// Messagerie : messages privés entre membres (lot à venir)
export default function MessagesPage() {
  const t = useTranslations("App.messages");

  return (
    <ComingSoon
      title={t("title")}
      description={t("question")}
      icon={MessageCircle}
      soonTitle={t("soonTitle")}
      soonDescription={t("soonDescription")}
    />
  );
}
