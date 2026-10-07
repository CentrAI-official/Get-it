import { Settings, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Barre du haut sur mobile : logo, langue, coach et réglages. */
export function AppTopbar() {
  const t = useTranslations("App.nav");
  const tCommon = useTranslations("Common");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-md lg:hidden">
      <Link href="/today" aria-label={tCommon("homeLink")}>
        <Logo className="text-lg" />
      </Link>
      <div className="flex items-center gap-1">
        <LocaleSwitcher />
        <Button asChild variant="ghost" size="icon-lg">
          <Link href="/coach" aria-label={t("coach")}>
            <Sparkles aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon-lg">
          <Link href="/settings" aria-label={t("settings")}>
            <Settings aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
