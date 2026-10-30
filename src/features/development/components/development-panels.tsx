import {
  Briefcase,
  ChevronRight,
  Handshake,
  Sparkles,
  Store,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
import { getCurrentProfile } from "@/server/profile/service";
import {
  DEVELOPMENT_KINDS,
  KIND_PILLAR,
  type DevelopmentKind,
} from "../questionnaires";
import { monthOf, planWeek } from "../calendar";
import { colorsOf } from "../colors";
import { CalendarView } from "./calendar-view";
import { DevelopmentFlow } from "./development-flow";

// Pages de « Mon développement ». Chacune lit la session : à placer dans un <Suspense>.

/**
 * Accueil : le calendrier principal, puis un plan par pilier (le plan
 * d'entreprise sous le financier). `day` : le jour à montrer (retour d'un
 * événement ajouté), aujourd'hui sinon.
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
                  href={`/services/${plan.kind}`}
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
        aria-labelledby="development-plans"
        className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
      >
        <h2 id="development-plans" className="caps-label text-muted-foreground">
          {t("hub.plansTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("hub.plansDescription")}
        </p>
        <ul className="mt-2 flex flex-col">
          {DEVELOPMENT_KINDS.map((kind) => {
            const Icon =
              kind === "business" ? Briefcase : pillarIcons[KIND_PILLAR[kind]];
            const plan = byKind.get(kind);
            return (
              <li
                key={kind}
                className="border-b border-foreground/8 last:border-b-0"
              >
                <Link
                  href={`/services/${kind}`}
                  className="-mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full orb">
                    <Icon aria-hidden="true" className="size-5 text-silver" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">
                      {t(`kinds.${kind}.title`)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {plan
                        ? t("hub.updated", {
                            date: format.dateTime(new Date(plan.updatedAt), {
                              dateStyle: "medium",
                            }),
                          })
                        : t(`kinds.${kind}.description`)}
                    </span>
                  </span>
                  <span
                    className={
                      plan
                        ? "text-sm font-medium text-muted-foreground"
                        : "text-sm font-medium text-primary"
                    }
                  >
                    {plan ? t("hub.open") : t("hub.create")}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
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
  DEVELOPMENT_KINDS.some((kind) => kind === value);

/** Page d'un plan : questionnaire, ou plan déjà créé. */
export async function DevelopmentLoader({ kind }: { kind: string }) {
  if (!isKind(kind)) notFound();
  const profile = await getCurrentProfile();
  const [page, calendar, t] = await Promise.all([
    getPlanPage(profile.id, kind),
    getCalendar(profile.id, kind),
    getTranslations("Development"),
  ]);
  const header = (
    <PageHeader
      title={t(`kinds.${kind}.title`)}
      description={
        page.stored
          ? t(`kinds.${kind}.description`)
          : t(`kinds.${kind}.formDescription`)
      }
    />
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
  const business = page.stored?.answers.business;

  return (
    <>
      {header}
      <DevelopmentFlow
        kind={kind}
        plan={page.stored?.plan ?? null}
        answers={page.stored?.answers ?? null}
        updatedAt={page.stored?.updatedAt ?? null}
        calendar={calendar}
        minDate={page.minDate}
        suggestBusiness={
          kind === "financial" &&
          (business === "has_business" || business === "wants_business")
        }
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
