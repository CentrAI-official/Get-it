import type { Metadata } from "next";
import { Suspense } from "react";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { UnreadPoller } from "@/features/messages/components/unread-poller";
import { AccountThemeSync } from "@/features/settings/components/account-theme";
import { DayPanel } from "@/features/today/components/day-panel";

// L'espace personnel n'a pas à être indexé par les moteurs de recherche
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh">
      {/* Fond fixe et uni, derrière tout le contenu */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-app"
      />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main
          id="main"
          className="flex-1 px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-2 lg:pb-12"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <AppMobileNav />
      {/* « Ma journée » : popup quotidien, ouvert aussi depuis la navigation */}
      <Suspense fallback={null}>
        <DayPanel />
      </Suspense>
      <UnreadPoller />
      {/* Thème choisi sur un autre appareil */}
      <Suspense fallback={null}>
        <AccountThemeSync />
      </Suspense>
    </div>
  );
}
