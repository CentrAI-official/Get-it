import { Check, Flame } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PILLARS, pillarIcons, type Pillar } from "@/config/pillars";
import { cn } from "@/lib/utils";

// Valeurs d'illustration pour la page d'accueil : ce ne sont pas des données utilisateur.
const EXAMPLE = {
  level: 12,
  xp: 2450,
  xpToNextLevel: 550,
  levelProgress: 68,
  streakDays: 18,
  pillars: {
    physical: 72,
    mental: 61,
    social: 48,
    financial: 67,
  } satisfies Record<Pillar, number>,
  tasks: [
    { key: "workout", done: true },
    { key: "meditation", done: true },
    { key: "budget", done: false },
  ],
} as const;

/** Aperçu illustratif de l'application, affiché dans le hero. */
export function HeroPreview() {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <figure
      aria-label={t("Marketing.preview.label")}
      className="relative mx-auto w-full max-w-md"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl"
      />
      <Card className="gap-6 bg-card/90 py-6 shadow-2xl backdrop-blur">
        <CardHeader className="gap-3 px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("Marketing.preview.level", { level: EXAMPLE.level })}
              </p>
              <p className="font-heading text-2xl font-semibold tracking-tight">
                {t("Marketing.preview.xp", { xp: EXAMPLE.xp })}
              </p>
            </div>
            <Badge variant="secondary" className="h-7 gap-1.5 px-2.5">
              <Flame aria-hidden="true" className="text-primary" />
              {t("Marketing.preview.streak", { days: EXAMPLE.streakDays })}
            </Badge>
          </div>
          <Progress
            value={EXAMPLE.levelProgress}
            className="h-2"
            aria-label={t("Marketing.preview.nextLevel", {
              remaining: EXAMPLE.xpToNextLevel,
              level: EXAMPLE.level + 1,
            })}
          />
          <p className="text-xs text-muted-foreground">
            {t("Marketing.preview.nextLevel", {
              remaining: EXAMPLE.xpToNextLevel,
              level: EXAMPLE.level + 1,
            })}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-6">
          <div>
            <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {t("Marketing.preview.today")}
            </p>
            <ul className="flex flex-col gap-2">
              {EXAMPLE.tasks.map(({ key, done }) => (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2.5 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {done ? <Check className="size-3" /> : null}
                  </span>
                  <span
                    className={cn(done && "text-muted-foreground line-through")}
                  >
                    {t(`Marketing.preview.tasks.${key}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {t("Marketing.preview.pillars")}
            </p>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-3">
              {PILLARS.map((pillar) => {
                const Icon = pillarIcons[pillar];
                const value = EXAMPLE.pillars[pillar];
                return (
                  <li key={pillar} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon aria-hidden="true" className="size-3.5" />
                        {t(`Pillars.${pillar}.name`)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {format.number(value / 100, { style: "percent" })}
                      </span>
                    </div>
                    <Progress
                      value={value}
                      className="h-1.5"
                      aria-label={t(`Pillars.${pillar}.name`)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </CardContent>
      </Card>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        {t("Marketing.preview.example")}
      </figcaption>
    </figure>
  );
}
