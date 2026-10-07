import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function SiteFooter() {
  const t = useTranslations("Marketing.footer");

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <LocaleSwitcher />
          <p>© Get iT. {t("rights")}</p>
        </div>
      </div>
    </footer>
  );
}
