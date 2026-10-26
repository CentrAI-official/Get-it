import { ChevronRight, Eye, RefreshCw, Trophy } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { isAiConfigured } from "@/server/ai/provider";
import { getAiProfile } from "@/server/ai/usage";
import { getCurrentProfile } from "@/server/profile/service";
import { getRankedState } from "@/server/ranked/service";
import { RANKED_PILLARS } from "../scoring";
import { LeaveRanked, RankedAnalyzeButton } from "./ranked-controls";
import { RankedForm } from "./ranked-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const link =
  "flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Mode Ranked : questionnaire (première fois ou réévaluation), sinon les
 * résultats. Lit la session : à placer dans un <Suspense>.
 */
export async function RankedPanel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const [params, state, t] = await Promise.all([
    searchParams,
    getRankedState(profile.id),
    getTranslations("Ranked"),
  ]);
  const reevaluate = params.reevaluate === "1";

  if (!state || (reevaluate && state.canReevaluate)) {
    return (
      <div className="flex flex-col gap-6">
        {state ? null : (
          <section className="flex flex-col gap-3">
            <p>{t("intro.what")}</p>
            <p className="text-sm text-muted-foreground">{t("intro.how")}</p>
          </section>
        )}
        <RankedForm initial={state?.answers ?? null} />
      </div>
    );
  }
  return <RankedResults state={state} userId={profile.id} />;
}

async function RankedResults({
  state,
  userId,
}: {
  state: NonNullable<Awaited<ReturnType<typeof getRankedState>>>;
  userId: string;
}) {
  const [t, tFactors, tPillars, format, aiProfile] = await Promise.all([
    getTranslations("Ranked"),
    getTranslations("Ranked.factors"),
    getTranslations("Pillars"),
    getFormatter(),
    getAiProfile(userId),
  ]);
  const { levels, result } = state;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const percent = (value: number) =>
    format.number(value / 100, { style: "percent", maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <ProgressRing value={levels.total / 100} className="size-24 p-1.5">
            <span className="flex flex-col items-center leading-none">
              <Trophy aria-hidden="true" className="size-4 text-primary" />
              <span className="font-mono text-3xl font-bold">
                {levels.total}
              </span>
            </span>
          </ProgressRing>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-heading text-2xl font-bold">
              {t("results.total", { level: levels.total })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("results.totalDescription", { level: levels.total })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("results.evaluatedOn", { date: date(state.evaluatedAt) })}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye aria-hidden="true" className="size-4 shrink-0 text-primary" />
          {t("results.public")}
        </p>
      </header>

      <section
        aria-labelledby="ranked-pillars"
        className="flex flex-col border-t border-white/8 pt-6"
      >
        <h2 id="ranked-pillars" className="mb-2 font-heading text-lg font-bold">
          {t("results.pillars")}
        </h2>
        <ul className="flex flex-col">
          {RANKED_PILLARS.map((pillar) => {
            const Icon = pillarIcons[pillar];
            const data = result.pillars[pillar];
            return (
              <li
                key={pillar}
                className="flex flex-col gap-3 border-b border-white/8 py-4"
              >
                <div className="flex items-center gap-3">
                  <ProgressRing
                    value={data.level / 100}
                    className="size-12 p-[3px]"
                  >
                    <span className="font-mono text-sm font-bold">
                      {data.level}
                    </span>
                  </ProgressRing>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-semibold">
                      <Icon aria-hidden="true" className="size-4 text-silver" />
                      {tPillars(`${pillar}.name`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("results.top", { top: Math.max(1, 100 - data.level) })}
                    </span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2 pl-15 text-sm">
                  {data.factors.map((factor) => (
                    <li key={factor.key} className="flex flex-col">
                      <span>
                        {t(
                          factor.byAge
                            ? "results.factorAge"
                            : "results.factorAdults",
                          {
                            factor: tFactors(factor.key),
                            percent: percent(factor.percentile),
                          },
                        )}
                      </span>
                      {factor.key === "run" ? (
                        <span className="text-xs text-muted-foreground">
                          {t("results.vo2max", { value: result.vo2max })}
                        </span>
                      ) : null}
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {factor.estimate ? (
                          <span className="rounded-full bg-white/8 px-2 py-0.5 font-medium text-foreground/80">
                            {t("results.estimate")}
                          </span>
                        ) : null}
                        {factor.source}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="ranked-analysis"
        className="flex flex-col gap-4 border-t border-white/8 pt-6"
      >
        <h2 id="ranked-analysis" className="font-heading text-lg font-bold">
          {t("analysis.title")}
        </h2>
        {state.analysis ? (
          <div className="flex flex-col gap-4">
            <p>{state.analysis.summary}</p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {RANKED_PILLARS.map((pillar) =>
                state.analysis?.pillars[pillar] ? (
                  <li key={pillar}>
                    <span className="font-semibold text-foreground">
                      {tPillars(`${pillar}.name`)}
                    </span>
                    {" — "}
                    {state.analysis.pillars[pillar]}
                  </li>
                ) : null,
              )}
            </ul>
            {state.analysis.tips.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="font-heading font-semibold">
                  {t("analysis.tips")}
                </h3>
                <ul className="flex flex-col">
                  {state.analysis.tips.map((tip) => (
                    <li
                      key={tip.title}
                      className="flex flex-col gap-0.5 border-b border-white/8 py-3"
                    >
                      <span className="font-semibold">{tip.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {tip.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : !isAiConfigured() ? (
          <p className="text-sm text-muted-foreground">
            {t("analysis.unavailable")}
          </p>
        ) : aiProfile?.consented ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {t("analysis.description")}
            </p>
            <RankedAnalyzeButton />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {t("analysis.consent")}
            </p>
            <Link href="/coach" className={link}>
              {t("analysis.consentLink")}
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-white/8 pt-6">
        {state.canReevaluate ? (
          <Button asChild className="w-fit">
            <Link href="/profile/ranked?reevaluate=1">
              <RefreshCw aria-hidden="true" />
              {t("results.reevaluate")}
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("results.nextOn", { date: date(state.nextAt) })}
          </p>
        )}
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
            <p>{t("method.limits")}</p>
            <p>{t("form.notice")}</p>
          </div>
        </details>
        <LeaveRanked />
      </section>
    </div>
  );
}

export function RankedSkeleton() {
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
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}
