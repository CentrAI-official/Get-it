import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { adminSignOutAction } from "@/features/admin/actions";
import { AdminNav, AdminSideNav } from "@/features/admin/components/admin-nav";

/**
 * Dashboard de l'équipe : une colonne de navigation sur ordinateur, une barre
 * du haut avec des pastilles sur téléphone. L'accès est revérifié par chaque
 * page et chaque lecture de données.
 */
export default function AdminDashboardLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  const t = useTranslations("Admin");
  const locale = useLocale();

  const signOut = (compact: boolean) => (
    <form action={adminSignOutAction}>
      <input type="hidden" name="locale" value={locale} />
      <Button
        type="submit"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        aria-label={compact ? t("signOut") : undefined}
        className={compact ? undefined : "w-full justify-start"}
      >
        <LogOut aria-hidden="true" />
        {compact ? null : t("signOut")}
      </Button>
    </form>
  );
  const brand = (
    <div className="flex items-baseline gap-2.5">
      <Logo />
      <span className="text-sm font-medium text-muted-foreground">
        {t("badge")}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r border-foreground/6 bg-nav px-4 py-6 lg:flex">
        <div className="px-3">{brand}</div>
        <Suspense fallback={null}>
          <AdminSideNav />
        </Suspense>
        <div className="mt-auto">{signOut(false)}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-foreground/6 bg-nav/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            {brand}
            {signOut(true)}
          </div>
          <Suspense fallback={null}>
            <AdminNav />
          </Suspense>
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
