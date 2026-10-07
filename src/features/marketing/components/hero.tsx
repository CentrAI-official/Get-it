import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { HeroPreview } from "./hero-preview";

export function Hero() {
  const t = useTranslations("Marketing.hero");

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-glow"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24 lg:pb-28">
        <div className="flex flex-col items-start gap-7">
          <Badge
            variant="outline"
            className="h-7 border-primary/30 bg-primary/10 px-3 text-primary"
          >
            {t("eyebrow")}
          </Badge>
          <h1 className="text-gradient-silver font-heading text-5xl leading-[1.02] font-bold tracking-tighter text-balance sm:text-6xl lg:text-7xl">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="block text-primary">{chunks}</span>
              ),
            })}
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            {t("subtitle")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href="/signup">
                {t("primaryCta")}
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 px-5 text-base"
            >
              <a href="#how">{t("secondaryCta")}</a>
            </Button>
          </div>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}
