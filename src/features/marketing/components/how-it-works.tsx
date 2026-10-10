import {
  CircleCheck,
  Route,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "./section-heading";

// La boucle produit : WANT → PLAN → DO → LEVEL UP
const STEPS = [
  { key: "want", icon: Target },
  { key: "plan", icon: Route },
  { key: "act", icon: CircleCheck },
  { key: "progress", icon: TrendingUp },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

export function HowItWorks() {
  const t = useTranslations("Marketing.how");

  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-20 border-t border-white/5"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading
          id="how-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />
        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li key={key} className="flex flex-col gap-4 rounded-3xl glass p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary font-mono font-bold text-primary-foreground glow-primary">
                  {index + 1}
                </span>
                <Icon aria-hidden="true" className="size-5 text-silver" />
              </div>
              <h3 className="font-heading text-lg font-semibold">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(`steps.${key}.description`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
