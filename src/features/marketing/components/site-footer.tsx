import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { legalReady } from "@/server/legal/service";

export function SiteFooter() {
  const t = useTranslations("Marketing.footer");
  const tLegal = useTranslations("App.settings.data");

  return (
    <footer className="border-t border-foreground/5">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {/* Loi 25 : seulement quand les pages sont en ligne */}
          {legalReady() ? (
            <>
              <Link href="/privacy" className="hover:text-foreground">
                {tLegal("privacy")}
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                {tLegal("terms")}
              </Link>
            </>
          ) : null}
          <LocaleSwitcher />
          <p>© Get iT. {t("rights")}</p>
        </div>
      </div>
    </footer>
  );
}
