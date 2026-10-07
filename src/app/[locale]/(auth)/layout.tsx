import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PILLARS, pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";

// Pages de compte : rien à indexer pour les moteurs de recherche
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Écran divisé : la marque à gauche (ordinateur), le formulaire à droite. */
export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = useTranslations();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border/60 bg-card p-10 lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-glow"
        />
        <Link
          href="/"
          aria-label={t("Common.homeLink")}
          className="relative w-fit"
        >
          <Logo className="text-2xl" />
        </Link>
        <div className="relative flex max-w-lg flex-col gap-6">
          <p className="text-gradient-silver font-heading text-4xl leading-tight font-bold tracking-tight text-balance xl:text-5xl">
            {t("Auth.brand.title")}
          </p>
          <p className="text-lg text-pretty text-muted-foreground">
            {t("Auth.brand.subtitle")}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-3">
            {PILLARS.map((pillar) => {
              const Icon = pillarIcons[pillar];
              return (
                <li
                  key={pillar}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm font-medium"
                >
                  <Icon aria-hidden="true" className="size-4 text-silver" />
                  {t(`Pillars.${pillar}.name`)}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-sm text-muted-foreground">
          {t("Common.slogan")}
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            aria-label={t("Common.homeLink")}
            className="lg:invisible"
          >
            <Logo />
          </Link>
          <LocaleSwitcher />
        </header>
        <main
          id="main"
          className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:px-6 sm:pt-0"
        >
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </div>
  );
}
