import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { IdentityChip } from "@/features/identity/components/identity-chip";
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
      <div className="flex min-w-0 items-center gap-3 lg:mr-auto">
        <Link
          href="/community"
          aria-label={tCommon("homeLink")}
          className="shrink-0 lg:hidden"
        >
          <Logo className="text-[1.65rem]" />
        </Link>
        {/* Sur sa page : son nom et son logo, toujours visibles */}
        <Suspense fallback={null}>
          <IdentityChip />
        </Suspense>
      </div>
      <TopActions />
    </header>
  );
}
