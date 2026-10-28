import { SiteFooter } from "@/features/marketing/components/site-footer";
import { SiteHeader } from "@/features/marketing/components/site-header";

export default function MarketingLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <>
      {/* Même fond que l'application */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-app"
      />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
