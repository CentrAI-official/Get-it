import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const SECTION_LINKS = [
  { id: "pillars", label: "pillars" },
  { id: "how", label: "how" },
  { id: "features", label: "features" },
] as const;

export function SiteHeader() {
  const t = useTranslations("Marketing.nav");
  const tCommon = useTranslations("Common");

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/5 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={tCommon("homeLink")}>
          <Logo />
        </Link>
        <nav
          aria-label={t("label")}
          className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
        >
          {SECTION_LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="transition-colors hover:text-foreground"
            >
              {t(label)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <Button asChild size="sm" variant="ghost">
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">{t("getStarted")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
