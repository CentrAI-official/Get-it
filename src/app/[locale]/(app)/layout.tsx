import type { Metadata } from "next";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

// L'espace personnel n'a pas à être indexé par les moteurs de recherche
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh">
      {/* Fond fixe : halos orange et quadrillage, derrière tout le contenu */}
      <div
        aria-hidden="true"
        className="bg-app pointer-events-none fixed inset-0 -z-10"
      />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main
          id="main"
          className="flex-1 px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <AppMobileNav />
    </div>
  );
}
