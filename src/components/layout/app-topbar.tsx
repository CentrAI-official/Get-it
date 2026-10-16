import { Settings, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { DayPanelButton } from "@/features/today/components/day-panel-button";
import { Link } from "@/i18n/navigation";

/** Barre du haut sur mobile : logo, langue, « Ma journée », Get iT AI et réglages. */
export function AppTopbar() {
  const t = useTranslations("App.nav");
  const tCommon = useTranslations("Common");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-background/70 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/community" aria-label={tCommon("homeLink")}>
        <Logo className="text-lg" />
      </Link>
      <div className="flex items-center gap-0.5">
        <LocaleSwitcher />
        <DayPanelButton variant="icon" />
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
