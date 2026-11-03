import { Handshake, Sparkles, Store } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import { AiConsentCard } from "@/features/coach/components/ai-consent-card";
import { Link } from "@/i18n/navigation";
import { isAiConfigured } from "@/server/ai/provider";
import {
  getCalendar,
  getPlanPage,
  listPlans,
} from "@/server/development/service";
import { isLoggedKind } from "@/features/plan-logs/rules";
import { getPlanLogPage } from "@/server/plan-logs/service";
import { getWorkoutPage } from "@/server/workouts/service";
import { getCurrentProfile } from "@/server/profile/service";
import {
  planHref,
  VISIBLE_KINDS,
  type DevelopmentKind,
} from "../questionnaires";
import { monthOf, planWeek } from "../calendar";
import { colorsOf } from "../colors";
import { CalendarView } from "./calendar-view";
import { DevelopmentFlow } from "./development-flow";

// Pages de « Mon développement ». Chacune lit la session : à placer dans un <Suspense>.

/** Les quatre sections de l'accueil. */
const SECTION_PILLARS = ["physical", "mental", "social", "financial"] as const;

/**
 * Accueil : le calendrier principal, puis les quatre sections (Physique,
 * Mental, Social, Financier) : chacune a son plan et sa bibliothèque ou son
 * outil. `day` : le jour à montrer (retour d'un événement ajouté),
 * aujourd'hui sinon.
 */
export async function DevelopmentHub({ day }: { day?: string }) {
  const profile = await getCurrentProfile();
  const chosen = z.iso.date().safeParse(day);
  const [plans, calendar, t, format] = await Promise.all([
    listPlans(profile.id),
    getCalendar(
      profile.id,
      "all",
      chosen.success ? monthOf(chosen.data) : undefined,
    ),
    getTranslations("Development"),
    getFormatter(),
  ]);
  const byKind = new Map(plans.map((plan) => [plan.kind, plan]));

  return (
    <div className="flex flex-col gap-8">
      {isAiConfigured() ? null : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Sparkles
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-silver"
          />
          {t("errors.notConfigured")}
        </p>
      )}
      {/* Calendrier principal : tous les plans, tâches, habitudes et objectifs */}
      <section
        aria-labelledby="development-calendar"
        className="flex flex-col gap-2"
      >
        <h2
          id="development-calendar"
          className="caps-label text-muted-foreground"
        >
          {t("calendar.title")}
        </h2>
        <div className="mt-2">
          <CalendarView
            initial={calendar}
            scope="all"
            initialDay={chosen.success ? chosen.data : undefined}
          />
        </div>
        {calendar.plans.length > 0 ? (
          // Raccourcis : chaque plan et sa semaine en cours
          <nav
            aria-label={t("calendar.plansLabel")}
            className="-mx-4 mt-3 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {calendar.plans.map((plan) => {
              const progress = planWeek(plan, calendar.today);
              return (
                <Link
                  key={plan.id}
                  href={planHref(plan.kind)}
                  aria-label={
                    progress
                      ? t("calendar.planWeekLabel", {
                          title: plan.title,
                          week: progress.week,
                          weeks: progress.weeks,
                        })
                      : plan.title
                  }
                  className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-foreground/[0.06] px-3.5 text-sm font-semibold outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${colorsOf(plan.kind).dot}`}
                  />
                  <span className="max-w-48 truncate">{plan.title}</span>
                  {progress ? (
                    <span
                      aria-hidden="true"
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {t("calendar.planWeek", {
                        week: progress.week,
                        weeks: progress.weeks,
                      })}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </section>
      <section
        aria-labelledby="development-sections"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <h2
          id="development-sections"
          className="caps-label text-muted-foreground"
        >
          {t("hub.sectionsTitle")}
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          {/* Physique regroupe l'entraînement et la nutrition */}
          {SECTION_PILLARS.map((kind) => {
            const Icon = pillarIcons[kind];
            const plan = byKind.get(kind);
            return (
              <li key={kind}>
                <Link
                  href={`/services/${kind}`}
                  className="flex h-full flex-col gap-3 rounded-3xl bg-foreground/[0.05] p-4 transition-colors outline-none hover:bg-foreground/[0.08] focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/14 text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-heading text-lg font-bold">
                      {t(`hub.sections.${kind}.title`)}
                    </span>
                    <span className="text-sm text-pretty text-muted-foreground">
                      {t(`hub.sections.${kind}.description`)}
                    </span>
                  </span>
                  <span
                    className={
                      plan
                        ? "mt-auto text-xs font-medium text-muted-foreground"
                        : "mt-auto text-xs font-semibold text-primary"
                    }
                  >
                    {plan
                      ? t("hub.updated", {
                          date: format.dateTime(new Date(plan.updatedAt), {
                            dateStyle: "medium",
                          }),
                        })
                      : t("hub.noPlan")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="development-pros"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <h2
          id="development-pros"
          className="flex items-center gap-2 font-heading text-lg font-bold"
        >
          <Handshake aria-hidden="true" className="size-5 text-silver" />
          {t("hub.prosTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("hub.prosDescription")}
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/marketplace">
            <Store aria-hidden="true" />
            {t("hub.prosAction")}
          </Link>
        </Button>
      </section>
    </div>
  );
}

export function DevelopmentHubSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-48" />
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center gap-4 py-4">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const isKind = (value: string): value is DevelopmentKind =>
  VISIBLE_KINDS.some((kind) => kind === value);

/**
 * Onglet « Mon plan » d'une section : questionnaire, ou plan déjà créé. Le
 * titre est celui de la section ; ici, seulement sa description.
 */
export async function DevelopmentLoader({ kind }: { kind: string }) {
  if (!isKind(kind)) notFound();
  const profile = await getCurrentProfile();
  const [page, calendar, t] = await Promise.all([
    getPlanPage(profile.id, kind),
    getCalendar(profile.id, kind),
    getTranslations("Development"),
  ]);
  // Le carnet d'entraînement, avec tout ce qu'il faut pour démarrer sans réseau
  const workouts =
    kind === "physical" && page.stored
      ? await getWorkoutPage(profile.id, page.stored.plan)
      : null;
  // Les éléments cochés des autres plans
  const logs =
    isLoggedKind(kind) && page.stored
      ? await getPlanLogPage(profile.id, kind, page.stored.plan)
      : null;
  const header = (
    <p className="text-sm text-pretty text-muted-foreground">
      {page.stored
        ? t(`kinds.${kind}.description`)
        : t(`kinds.${kind}.formDescription`)}
    </p>
  );

  if (!page.configured && !page.stored) {
    return (
      <>
        {header}
        <EmptyState
          icon={Sparkles}
          title={t("notConfiguredTitle")}
          description={t("errors.notConfigured")}
        />
      </>
    );
  }
  if (!page.consented && !page.stored) {
    return (
      <>
        {header}
        <AiConsentCard />
      </>
    );
  }
  return (
    <>
      {/* Un plan créé commence par sa semaine (design « Aujourd'hui ») */}
      {page.stored ? null : header}
      <DevelopmentFlow
        kind={kind}
        plan={page.stored?.plan ?? null}
        answers={page.stored?.answers ?? null}
        updatedAt={page.stored?.updatedAt ?? null}
        calendar={calendar}
        workouts={workouts}
        logs={logs}
        minDate={page.minDate}
      />
    </>
  );
}

export function DevelopmentSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <Skeleton className="mt-4 h-6 w-40" />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-9 w-28 rounded-full" />
        ))}
      </div>
    </div>
  );
}
