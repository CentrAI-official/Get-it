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
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24 lg:pb-28">
        <div className="flex flex-col items-start gap-7">
          <Badge
            variant="outline"
            className="h-7 border-foreground/10 bg-foreground/5 px-3 text-[0.7rem] font-semibold tracking-[0.14em] text-silver uppercase"
          >
            {t("eyebrow")}
          </Badge>
          <h1 className="text-gradient-silver font-display text-6xl leading-[0.92] text-balance uppercase sm:text-7xl lg:text-8xl">
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
