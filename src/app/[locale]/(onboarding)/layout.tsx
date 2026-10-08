import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Parcours de départ : sans navigation, pour se concentrer sur les questions. */
export default function OnboardingLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between gap-2 border-b border-border/60 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <SignOutButton variant="ghost" className="text-muted-foreground" />
        </div>
      </header>
      <main id="main" className="flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
