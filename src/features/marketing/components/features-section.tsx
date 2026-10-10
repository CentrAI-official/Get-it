import {
  CalendarCheck,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

const FEATURES = [
  { key: "today", icon: CalendarCheck },
  { key: "ai", icon: Sparkles },
  { key: "progress", icon: Trophy },
  { key: "community", icon: Users },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

export function FeaturesSection() {
  const t = useTranslations("Marketing.features");

  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-20 border-t border-white/5"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading
          id="features-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />
        <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Card className="h-full flex-row items-start gap-4 p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full orb text-silver">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-heading text-base font-semibold">
                    {t(`items.${key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`items.${key}.description`)}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
