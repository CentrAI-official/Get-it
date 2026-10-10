import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { PILLARS, pillarIcons } from "@/config/pillars";
import { SectionHeading } from "./section-heading";

export function PillarsSection() {
  const t = useTranslations();

  return (
    <section
      id="pillars"
      aria-labelledby="pillars-title"
      className="scroll-mt-20 border-t border-white/5"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading
          id="pillars-title"
          title={t("Marketing.pillars.title")}
          subtitle={t("Marketing.pillars.subtitle")}
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => {
            const Icon = pillarIcons[pillar];
            return (
              <li key={pillar}>
                <Card className="h-full gap-4 p-6 transition-[border-color,translate] hover:border-white/20 motion-safe:hover:-translate-y-0.5">
                  <span className="flex size-12 items-center justify-center rounded-full orb text-silver">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="font-heading text-lg font-semibold">
                    {t(`Pillars.${pillar}.name`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`Pillars.${pillar}.description`)}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
