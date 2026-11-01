import { ChevronRight, Eye, Target } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { getLevelState, type PillarState } from "@/server/levels/service";
import { getCurrentProfile } from "@/server/profile/service";
import { LEVEL_FACTORS, LEVEL_PILLARS, type LevelFactor } from "../factors";
import {
  formatFactorValue,
  levelGoalTitle,
  type FormatContext,
} from "../format";
import { FACTOR_REFERENCE } from "../scale";
import { EraseLevels, MeasureDialog, RankedSwitch } from "./levels-controls";
import { MeasureForm } from "./measure-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const link =
  "flex w-fit items-center gap-1 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Mes niveaux : le niveau de chaque pilier (sa mesure la plus faible), chaque
 * mesure avec son niveau, ce qu'il faut pour monter, et le mode Ranked.
 * `?mesure=<mesure>` ouvre directement la fenêtre de cette mesure (depuis un
 * objectif de niveau). Lit la session : à placer dans un <Suspense>.
 */
export async function LevelsPanel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const [params, state, t] = await Promise.all([
    searchParams,
    getLevelState(profile.id),
    getTranslations("Levels"),
  ]);
  const { person } = state;
  if (!person) {
    // Renseignements du compte : toujours remplis dans l'application
    return (
      <p className="text-sm text-muted-foreground">
        {t("errors.detailsMissing")}
      </p>
    );
  }
  const requested = LEVEL_FACTORS.find((factor) => factor === params.mesure);
  const context: FormatContext = {
    country: person.country,
    sex: person.sex,
    weightKg: state.weightKg,
  };
  const measured = LEVEL_PILLARS.some((pillar) =>
    state.pillars[pillar].factors.some((factor) => factor.value !== null),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <ProgressRing
            value={(state.total ?? 0) / 100}
            className="size-24 shrink-0 p-1.5"
          >
            <span className="font-display text-3xl">{state.total ?? "—"}</span>
          </ProgressRing>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-heading text-2xl font-bold">
              {state.total === null
                ? t("total.none")
                : t("total.level", { level: state.total })}
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">
              {state.total === null
                ? t("total.noneDescription")
                : t("total.description")}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Eye
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            {state.rankedAt ? t("ranked.on") : t("ranked.off")}
          </p>
          <RankedSwitch ranked={state.rankedAt !== null} />
        </div>
      </header>

      {LEVEL_PILLARS.map((pillar) => (
        <PillarSection
          key={pillar}
          state={state.pillars[pillar]}
          context={context}
          requested={requested ?? null}
        />
      ))}

      <section className="flex flex-col gap-3 border-t border-foreground/8 pt-6">
        <details className="group text-sm text-muted-foreground">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-90"
            />
            {t("method.title")}
          </summary>
          <div className="mt-2 flex flex-col gap-2 text-pretty">
            <p>{t("method.how")}</p>
            <p>{t("method.elite")}</p>
            <p>{t("method.limits")}</p>
            <p>{t("method.notice")}</p>
          </div>
        </details>
        {measured ? <EraseLevels /> : null}
      </section>
    </div>
  );
}

async function PillarSection({
  state,
  context,
  requested,
}: {
  state: PillarState;
  context: FormatContext;
  requested: LevelFactor | null;
}) {
  const [t, tFactors, tPillars, tGoals, format] = await Promise.all([
    getTranslations("Levels"),
    getTranslations("Levels.factors"),
    getTranslations("Pillars"),
    getTranslations("Levels.goals"),
    getFormatter(),
  ]);
  const { pillar, level, factors, next } = state;
  const Icon = pillarIcons[pillar];
  const started = factors.some((factor) => factor.value !== null);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "long" });
  const title = (factor: LevelFactor, target: number) =>
    levelGoalTitle(
      tGoals as unknown as Parameters<typeof levelGoalTitle>[0],
      format,
      factor,
      target,
      context,
    );

  return (
    <section
      aria-labelledby={`levels-${pillar}`}
      className="flex flex-col gap-4 border-t border-foreground/8 pt-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id={`levels-${pillar}`}
          className="flex items-center gap-2 font-heading text-xl font-bold"
        >
          <Icon aria-hidden="true" className="size-5 text-primary" />
          {tPillars(`${pillar}.name`)}
        </h2>
        <p className="font-display text-3xl leading-none">
          {level === null ? (
            <span className="font-sans text-base font-semibold text-muted-foreground normal-case">
              {t("notEvaluated")}
            </span>
          ) : (
            t("pillarLevel", { level })
          )}
        </p>
      </div>

      {!started ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-pretty">{t(`intro.${pillar}`)}</p>
          <MeasureForm
            factors={factors.map((factor) => factor.factor)}
            consentRequired
            country={context.country}
            sex={context.sex}
          />
        </div>
      ) : (
        <>
          {next.length > 0 ? (
            // Ce qu'il faut atteindre pour monter : les objectifs de niveau
            <div className="flex flex-col gap-2 rounded-2xl bg-primary/[0.07] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Target aria-hidden="true" className="size-4 text-primary" />
                {t("next.title", { level: next[0]?.level ?? 2 })}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {next.map((goal) => (
                  <li key={goal.factor}>{title(goal.factor, goal.target)}</li>
                ))}
              </ul>
              <Link href="/goals" className={link}>
                {t("next.goals")}
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : level === null ? (
            <p className="text-sm text-muted-foreground">{t("next.missing")}</p>
          ) : level >= 100 ? (
            <p className="text-sm font-semibold text-primary">
              {t("next.top")}
            </p>
          ) : null}

          <ul className="flex flex-col">
            {factors.map((factor) => {
              const reference = FACTOR_REFERENCE[factor.factor];
              return (
                <li
                  key={factor.factor}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-foreground/8 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">
                      {tFactors(factor.factor)}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {factor.value === null ? (
                        t("toMeasure")
                      ) : (
                        <>
                          <span className="font-semibold text-foreground tabular-nums">
                            {formatFactorValue(
                              format,
                              factor.factor,
                              factor.value,
                              context,
                            )}
                          </span>
                          {factor.measuredAt
                            ? t("measuredOn", { date: date(factor.measuredAt) })
                            : null}
                        </>
                      )}
                      {reference.estimate ? (
                        <span className="rounded-full bg-foreground/8 px-2 py-0.5 font-medium text-foreground/80">
                          {t("estimate")}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {factor.level !== null ? (
                      <span className="font-display text-xl tabular-nums">
                        {t("pillarLevel", { level: factor.level })}
                      </span>
                    ) : null}
                    {factor.availableAt ? (
                      <span className="text-xs text-muted-foreground">
                        {t("availableOn", { date: date(factor.availableAt) })}
                      </span>
                    ) : (
                      <MeasureDialog
                        factor={factor.factor}
                        label={
                          factor.value === null ? t("measure") : t("remeasure")
                        }
                        consentRequired={false}
                        country={context.country}
                        sex={context.sex}
                        defaultOpen={requested === factor.factor}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export function LevelsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-5">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-40 w-full" />
      ))}
    </div>
  );
}
