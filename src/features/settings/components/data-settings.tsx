import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { legalReady } from "@/server/legal/service";

/**
 * Réglages › Tes données (Loi 25) : télécharger tout ce que Get iT garde, et les
 * pages Confidentialité et Conditions quand elles sont en ligne.
 */
export function DataSettings() {
  const t = useTranslations("App.settings.data");
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        {/* Un lien de téléchargement ordinaire : le navigateur enregistre le fichier */}
        <a
          href="/api/v1/account/export"
          download
          className="inline-flex h-11 items-center gap-2 rounded-full border border-foreground/15 px-4 text-sm font-semibold outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Download aria-hidden="true" className="size-4" />
          {t("download")}
        </a>
        <p className="text-xs text-pretty text-muted-foreground">{t("hint")}</p>
        {legalReady() ? (
          <div className="flex flex-wrap gap-x-4">
            <Link
              href="/privacy"
              className="flex min-h-11 items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="flex min-h-11 items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("terms")}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
