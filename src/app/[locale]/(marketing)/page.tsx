import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { FeaturesSection } from "@/features/marketing/components/features-section";
import { FinalCta } from "@/features/marketing/components/final-cta";
import { Hero } from "@/features/marketing/components/hero";
import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { PillarsSection } from "@/features/marketing/components/pillars-section";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  return {
    alternates: {
      canonical: `/${locale}`,
      languages: { fr: "/fr", en: "/en", "x-default": "/" },
    },
  };
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <PillarsSection />
      <HowItWorks />
      <FeaturesSection />
      <FinalCta />
    </>
  );
}
