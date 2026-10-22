import { Handshake, Store } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.services");
  return { title: t("title") };
}

// Mes services : professionnels, rendez-vous et notes de session (lots à venir)
export default function ServicesPage() {
  const t = useTranslations("App.services");

  return (
    <ComingSoon
      title={t("title")}
      description={t("question")}
      icon={Handshake}
      soonTitle={t("soonTitle")}
      soonDescription={t("soonDescription")}
      action={
        <Button asChild variant="outline">
          <Link href="/marketplace">
            <Store aria-hidden="true" />
            {t("shop")}
          </Link>
        </Button>
      }
    />
  );
}
