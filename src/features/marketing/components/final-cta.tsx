import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function FinalCta() {
  const t = useTranslations("Marketing.cta");

  return (
    <section aria-labelledby="cta-title" className="px-4 pb-24 sm:px-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-primary/20 bg-card px-6 py-16 text-center sm:px-12 lg:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-glow"
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
          <h2
            id="cta-title"
            className="text-gradient-silver font-heading text-3xl font-bold tracking-tight text-balance sm:text-5xl"
          >
            {t("title")}
          </h2>
          <p className="text-lg text-pretty text-muted-foreground">
            {t("subtitle")}
          </p>
          <Button asChild size="lg" className="mt-2 h-11 px-6 text-base">
            <Link href="/signup">
              {t("button")}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
