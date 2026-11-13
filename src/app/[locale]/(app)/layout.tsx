import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { NavigationMemory } from "@/components/layout/navigation-memory";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { ActivityTracker } from "@/features/analytics/components/activity-tracker";
import { WeekQuestion } from "@/features/feedback/components/week-question";
import { UnreadPoller } from "@/features/messages/components/unread-poller";
import { NotificationPoller } from "@/features/notifications/components/notification-bell";
import { AccountThemeSync } from "@/features/settings/components/account-theme";
import { TimeZoneCheck } from "@/features/settings/components/time-zone-settings";
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
          {/* Changement de page : le contenu glisse (avancer, revenir) ou se
              fond (onglet) ; les barres du haut et du bas ne bougent pas */}
          <ViewTransition
            update={{
              "nav-forward": "nav-forward",
              "nav-back": "nav-back",
              "nav-tab": "nav-tab",
              default: "none",
            }}
            default="none"
          >
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </ViewTransition>
        </main>
      </div>
      <AppMobileNav />
      {/* Réseau coupé : les gestes attendent et repartent tout seuls */}
      <OfflineBanner />
      {/* Tirer vers le bas en haut de la page : rechargement (téléphone) */}
      <PullToRefresh />
      {/* « Ma journée » : popup quotidien, ouvert aussi depuis la navigation */}
      <Suspense fallback={null}>
        <DayPanel />
      </Suspense>
      <UnreadPoller />
      <NotificationPoller />
      {/* Question d'une semaine : une seule fois, après « Ma journée » */}
      <Suspense fallback={null}>
        <WeekQuestion />
      </Suspense>
      {/* Temps actif par page (dashboard de l'équipe) ; usePathname suspend */}
      <Suspense fallback={null}>
        <ActivityTracker />
      </Suspense>
      {/* Pages vues : « Retour » revient à la page d'avant s'il y en a une */}
      <Suspense fallback={null}>
        <NavigationMemory />
      </Suspense>
      {/* Le téléphone n'est plus à l'heure du compte : proposer de changer */}
      <Suspense fallback={null}>
        <TimeZoneCheck />
      </Suspense>
      {/* Thème choisi sur un autre appareil */}
      <Suspense fallback={null}>
        <AccountThemeSync />
      </Suspense>
    </div>
  );
}
