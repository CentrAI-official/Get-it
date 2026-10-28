import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { TopActions } from "./top-actions";

/**
 * Barre du haut : logo (mobile) et boutons propres à la catégorie. Sur
 * ordinateur, le logo est dans la barre latérale.
 */
export function AppTopbar() {
  const tCommon = useTranslations("Common");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-foreground/5 bg-background/70 px-4 backdrop-blur-xl lg:h-16 lg:justify-end lg:border-transparent lg:bg-transparent lg:px-10 lg:backdrop-blur-none">
      <Link
        href="/community"
        aria-label={tCommon("homeLink")}
        className="lg:hidden"
      >
        <Logo className="text-lg" />
      </Link>
      <TopActions />
    </header>
  );
}
