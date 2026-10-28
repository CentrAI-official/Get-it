import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { THEME_COLORS } from "@/config/theme";
import { ThemeScript } from "@/components/theme-script";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import "../globals.css";

// Inter pour le texte ; Anton (étroite et grasse) pour les titres en majuscules et les grands chiffres
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

// Requis par Cache Components : chaque langue est prérendue au build
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: t("title"), template: `%s · ${siteConfig.name}` },
    description: t("description"),
    applicationName: siteConfig.name,
  };
}

export const viewport: Viewport = {
  // Barre du navigateur : le fond du thème (ajustée par ThemeScript si le choix diffère de l'appareil)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const t = await getTranslations("Common");

  return (
    <html
      lang={locale}
      className={cn(inter.variable, anton.variable)}
      // ThemeScript ajoute « dark » avant l'affichage : différence attendue avec le serveur
      suppressHydrationWarning
      // Défilement doux (globals.css) désactivé pendant les changements de page
      data-scroll-behavior="smooth"
    >
      <body className="min-h-dvh">
        <ThemeScript />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
