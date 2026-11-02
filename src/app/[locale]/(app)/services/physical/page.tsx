import type { Metadata } from "next";
import { ChevronRight, Dumbbell, Utensils } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DevelopmentSection } from "@/features/development/components/development-section";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Development.section");
  return { title: t("physical.title") };
}

const PARTS = [
  { key: "training", href: "/services/physical/training", Icon: Dumbbell },
  { key: "nutrition", href: "/services/physical/nutrition", Icon: Utensils },
] as const;

// Mon développement › Physique : l'entraînement et la nutrition
export default function PhysicalPage() {
  const t = useTranslations("Development.section");

  return (
    <DevelopmentSection section="physical">
      <ul className="grid gap-3 sm:grid-cols-2">
        {PARTS.map(({ key, href, Icon }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex items-center gap-4 rounded-3xl bg-foreground/[0.05] p-5 transition-colors outline-none hover:bg-foreground/[0.08] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-heading text-xl font-bold">
                  {t(`${key}.title`)}
                </span>
                <span className="text-sm text-pretty text-muted-foreground">
                  {t(`${key}.card`)}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </DevelopmentSection>
  );
}
