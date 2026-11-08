import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clients");
  return { title: t("title") };
}

// Clients de la page pro (mode page, à la place de Mon développement) : lot 3
export default function ClientsPage() {
  const t = useTranslations("Clients");

  return (
    <ComingSoon
      title={t("title")}
      description={t("question")}
      icon={ClipboardList}
      soonTitle={t("soonTitle")}
      soonDescription={t("soonDescription")}
    />
  );
}
