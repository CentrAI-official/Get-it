import {
  Activity,
  ArrowDown,
  Bug,
  Clock,
  Download,
  Eye,
  LogIn,
  MessageSquareText,
  Sparkles,
  Upload,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { RETENTION_WEEKS, relativeChange } from "@/features/analytics/metrics";
import {
  DASHBOARD_TIME_ZONE,
  parsePeriod,
  type DashboardPeriod,
} from "@/features/analytics/rules";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  getAiUsage,
  getFeatures,
  getOverview,
  getRetention,
  getSections,
  type Compared,
} from "@/server/admin/analytics";
import { listAuditEntries, openAdminPage } from "@/server/admin/audit";
import { getAlerts } from "@/server/admin/insights";
import { CATEGORY_ICONS, FEATURE_ICONS } from "../icons";
import { DailyChart } from "./daily-chart";
import {
  EmptyNote,
  IconChip,
  KpiTile,
  Meter,
  Panel,
  RankList,
  type RankRow,
} from "./dashboard-ui";
import { NorthStarHero } from "./north-star";
import { PeriodTabs } from "./period-tabs";

// Contenu des pages du dashboard : chaque panneau revérifie l'accès (et
// l'inscrit au journal) avant de lire les données. À placer dans un <Suspense>.

export type PanelProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function formatters() {
  const format = await getFormatter();
  const percent = (value: number | null) =>
    value === null
      ? "—"
      : format.number(value, { style: "percent", maximumFractionDigits: 0 });
  return {
    percent,
    number: (value: number) => format.number(value),
    compact: (value: number) =>
      format.number(value, { notation: "compact", maximumFractionDigits: 1 }),
    minutes: (value: number) =>
      format.number(value, { maximumFractionDigits: value < 10 ? 1 : 0 }),
    day: (day: string) =>
      format.dateTime(toDbDate(day), {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    /** Évolution signée (« +12 % ») d'un chiffre comparé à la période précédente. */
    change: ({ value, previous }: Compared) => {
      const change = relativeChange(value, previous);
      return change === null
        ? null
        : {
            value: change,
            text: format.number(change, {
              style: "percent",
              maximumFractionDigits: 0,
              signDisplay: "exceptZero",
            }),
          };
    },
  };
}

/** En-tête d'une page : la période à droite. */
export function PanelTop({
  href,
  period,
  children,
}: {
  href: `/${string}`;
  period: DashboardPeriod;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-muted-foreground">{children}</div>
      <PeriodTabs href={href} period={period} />
    </div>
  );
}

export async function OverviewPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("overview");
  const [t, tCommon, tFeatures, data, features, alerts, f] = await Promise.all([
    getTranslations("Admin.overview"),
    getTranslations("Admin.common"),
    getTranslations("Admin.features"),
    getOverview(period),
    getFeatures(period),
    getAlerts(),
    formatters(),
  ]);
  const vsPeriod = tCommon("vsPeriod", { days: period });
  const top = features.features.filter((row) => row.users > 0).slice(0, 3);
  const bottom = [...features.features].reverse().slice(0, 3);
  const featureRows = (rows: typeof top): RankRow[] => {
    const max = Math.max(1, ...features.features.map((row) => row.users));
    return rows.map((row) => ({
      key: row.key,
      icon: FEATURE_ICONS[row.key],
      label: tFeatures(`names.${row.key}`),
      value: f.percent(row.reach),
      ratio: row.users / max,
      muted: row.users === 0,
      details: [
        tCommon("users", { count: row.users }),
        tCommon("actions", { count: row.actions }),
      ],
    }));
  };
  const share = (count: number) =>
    data.members === 0 ? null : count / data.members;

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin" period={period}>
        {alerts.feedback > 0 || alerts.errors > 0 ? (
          <span className="flex flex-wrap gap-2">
            {alerts.feedback > 0 ? (
              <Link
                href="/admin/feedback?p=7"
                className="flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-primary/20 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <MessageSquareText
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                {t("alerts.feedback", { count: alerts.feedback })}
              </Link>
            ) : null}
            {alerts.errors > 0 ? (
              <Link
                href="/admin/errors?p=7"
                className="flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Bug aria-hidden="true" className="size-4" />
                {t("alerts.errors", { count: alerts.errors })}
              </Link>
            ) : null}
          </span>
        ) : null}
      </PanelTop>
      <NorthStarHero
        title={t("hero.title")}
        caption={
          data.northStar.value === null
            ? t("hero.empty")
            : t("hero.caption", { share: f.percent(data.northStar.value) })
        }
        value={data.northStar.value}
        change={f.change(data.northStar)}
        changeLabel={tCommon("vsWeek")}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          icon={Users}
          label={t("stats.members")}
          value={f.number(data.members)}
          hint={t("stats.membersHint", { count: data.onboarded })}
        />
        <KpiTile
          icon={UserRoundPlus}
          label={t("stats.newMembers")}
          value={f.number(data.newMembers.value ?? 0)}
          change={f.change(data.newMembers)}
          changeLabel={vsPeriod}
          hint={t("stats.newMembersHint")}
          trend={data.series.map((day) => day.signups)}
        />
        <KpiTile
          icon={Activity}
          label={t("stats.active")}
          value={f.number(data.active.value ?? 0)}
          change={f.change(data.active)}
          changeLabel={vsPeriod}
          hint={t("stats.activeHint")}
          trend={data.series.map((day) => day.active)}
        />
        <KpiTile
          icon={Clock}
          label={t("stats.minutes")}
          value={
            data.minutesPerDay.value === null
              ? "—"
              : f.minutes(data.minutesPerDay.value)
          }
          change={f.change(data.minutesPerDay)}
          changeLabel={vsPeriod}
          hint={t("stats.minutesHint")}
          trend={data.series.map((day) => day.minutes)}
        />
      </div>
      <Panel title={t("charts.active")} description={t("activeNote")}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["dau", f.number(data.dau)],
              ["wau", f.number(data.wau)],
              ["mau", f.number(data.mau)],
              ["stickiness", f.percent(data.stickiness)],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t(`stats.${key}`)}
              </dt>
              <dd className="text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <DailyChart
          title={t("charts.active")}
          kind="area"
          data={data.series.map(({ day, active }) => ({ day, value: active }))}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("works")} description={t("worksNote")}>
          {top.length === 0 ? (
            <EmptyNote>{tFeatures("unused")}</EmptyNote>
          ) : (
            <RankList label={t("works")} rows={featureRows(top)} />
          )}
        </Panel>
        <Panel title={t("watch")} description={t("watchNote")}>
          <RankList label={t("watch")} rows={featureRows(bottom)} />
          <Link
            href={`/admin/features?p=${period}`}
            className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("allFeatures")}
          </Link>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("charts.signups")}>
          <DailyChart
            title={t("charts.signups")}
            kind="bar"
            data={data.series.map(({ day, signups }) => ({
              day,
              value: signups,
            }))}
          />
        </Panel>
        <Panel title={t("charts.minutes")}>
          <DailyChart
            title={t("charts.minutes")}
            kind="bar"
            data={data.series.map(({ day, minutes }) => ({
              day,
              value: minutes,
            }))}
          />
        </Panel>
      </div>
      <Panel title={t("consents")}>
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ["personalized", data.personalized],
              ["aiConsent", data.aiConsent],
            ] as const
          ).map(([key, count]) => (
            <Meter
              key={key}
              label={t(`stats.${key}`)}
              value={f.percent(share(count))}
              ratio={share(count) ?? 0}
              detail={t(`stats.${key}Hint`, { count })}
            />
          ))}
        </div>
      </Panel>
      <p className="text-xs text-muted-foreground">{tCommon("excluded")}</p>
    </div>
  );
}

export async function SectionsPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("sections");
  const [t, tCommon, tAdmin, data, f] = await Promise.all([
    getTranslations("Admin.sections"),
    getTranslations("Admin.common"),
    getTranslations("Admin"),
    getSections(period),
    formatters(),
  ]);
  const maxSection = Math.max(1, ...data.sections.map((row) => row.minutes));
  const maxOpens = Math.max(1, ...data.opens.map((row) => row.opens));
  // Une section retirée de l'application garde ses anciennes mesures : « Autre page »
  const sectionName = (key: string) => {
    const name = `sectionNames.${key}` as "sectionNames.other";
    return tAdmin.has(name) ? tAdmin(name) : tAdmin("sectionNames.other");
  };
  const categoryOfKey = (key: string) =>
    data.sections.find((row) => row.key === key)?.category ?? "other";

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/sections" period={period}>
        {t("users", { users: data.users })}
      </PanelTop>
      {data.sections.length === 0 ? (
        <Panel title={t("categories")}>
          <EmptyNote>{t("empty")}</EmptyNote>
        </Panel>
      ) : (
        <>
          <Panel title={t("categories")} description={t("note")}>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.categories.map((row, index) => (
                <li
                  key={row.key}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl p-4",
                    index === 0
                      ? "bg-primary/[0.08] ring-1 ring-primary/20"
                      : "bg-foreground/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <IconChip icon={CATEGORY_ICONS[row.category]} size="sm" />
                    <span className="font-medium">
                      {tAdmin(`categories.${row.category}`)}
                    </span>
                  </div>
                  <p className="font-display text-4xl leading-none">
                    {tCommon("minutes", { minutes: f.minutes(row.minutes) })}
                  </p>
                  <div
                    aria-hidden="true"
                    className="h-1.5 overflow-hidden rounded-full bg-foreground/6"
                  >
                    <div
                      className="h-full rounded-full bg-chart-1"
                      style={{ width: `${(row.share ?? 0) * 100}%` }}
                    />
                  </div>
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {tCommon("share", { share: f.percent(row.share) })}
                    </span>
                    <span>
                      {tCommon("perUser", {
                        minutes: f.minutes(row.minutesPerUser),
                      })}
                    </span>
                    <span>
                      {tCommon("reach", { reach: f.percent(row.reach) })}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t("sections")}>
            <RankList
              label={t("sections")}
              rows={data.sections.map((row) => ({
                key: row.key,
                icon: CATEGORY_ICONS[row.category],
                label: `${tAdmin(`categories.${row.category}`)} › ${sectionName(row.key)}`,
                value: tCommon("minutes", { minutes: f.minutes(row.minutes) }),
                ratio: row.minutes / maxSection,
                details: [
                  tCommon("perUser", {
                    minutes: f.minutes(row.minutesPerUser),
                  }),
                  tCommon("users", { count: row.users }),
                ],
              }))}
            />
          </Panel>
        </>
      )}
      {data.opens.length > 0 ? (
        <Panel title={t("overlays")}>
          <RankList
            label={t("overlays")}
            rows={data.opens.map((row) => ({
              key: row.key,
              icon: CATEGORY_ICONS[categoryOfKey(row.key)],
              label: sectionName(row.key),
              value: f.number(row.opens),
              ratio: row.opens / maxOpens,
              details: [
                t("opensCount", { count: row.opens }),
                tCommon("users", { count: row.users }),
              ],
            }))}
          />
        </Panel>
      ) : null}
      <p className="text-xs text-muted-foreground">{tCommon("excluded")}</p>
    </div>
  );
}

export async function FeaturesPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("features");
  const [t, tCommon, data, f] = await Promise.all([
    getTranslations("Admin.features"),
    getTranslations("Admin.common"),
    getFeatures(period),
    formatters(),
  ]);
  const maxUsers = Math.max(1, ...data.features.map((row) => row.users));
  const rows: RankRow[] = data.features.map((row) => ({
    key: row.key,
    icon: FEATURE_ICONS[row.key],
    label: t(`names.${row.key}`),
    value: f.percent(row.reach),
    ratio: row.users / maxUsers,
    muted: row.users === 0,
    details:
      row.users === 0
        ? [t("unused")]
        : [
            tCommon("users", { count: row.users }),
            tCommon("actions", { count: row.actions }),
          ],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/features" period={period}>
        {t("activeUsers", { count: data.activeUsers })}
      </PanelTop>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("top")} description={t("topNote")}>
          <RankList
            label={t("top")}
            rows={rows.filter((row) => !row.muted).slice(0, 5)}
          />
        </Panel>
        <Panel title={t("bottom")} description={t("bottomNote")}>
          <RankList
            label={t("bottom")}
            rows={[...rows].reverse().slice(0, 5)}
          />
        </Panel>
      </div>
      <Panel title={t("all")} description={t("description")}>
        <RankList label={t("all")} rows={rows} />
      </Panel>
      <p className="text-xs text-muted-foreground">{tCommon("excluded")}</p>
    </div>
  );
}

/** Teinte orange proportionnelle à la part (0 à 1), pour lire la grille d'un coup d'œil. */
function heat(value: number | null) {
  if (value === null) return undefined;
  return {
    backgroundColor: `color-mix(in oklab, var(--chart-1) ${Math.round(
      8 + value * 72,
    )}%, transparent)`,
  };
}

export async function RetentionPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("retention");
  const [t, tCommon, data, f] = await Promise.all([
    getTranslations("Admin.retention"),
    getTranslations("Admin.common"),
    getRetention(period),
    formatters(),
  ]);
  const signedUp = data.funnel[0]?.count ?? 0;
  // Une semaine sans inscription n'a rien à montrer
  const cohorts = data.cohorts.filter((cohort) => cohort.size > 0);
  const columns = [
    t("day1"),
    ...Array.from({ length: RETENTION_WEEKS }, (_, index) =>
      t("weekN", { n: index + 2 }),
    ),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/retention" period={period} />
      <Panel title={t("cohorts")} description={t("cohortsNote")}>
        {cohorts.length === 0 ? (
          <EmptyNote>{t("empty")}</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[10rem_repeat(5,minmax(0,1fr))] gap-2 px-1 text-xs text-muted-foreground sm:grid"
            >
              <span>{t("weekHeader")}</span>
              {columns.map((column) => (
                <span key={column} className="text-center">
                  {column}
                </span>
              ))}
            </div>
            <ol className="flex flex-col gap-2">
              {cohorts.map((cohort) => (
                <li
                  key={cohort.week}
                  className="grid grid-cols-5 gap-2 sm:grid-cols-[10rem_repeat(5,minmax(0,1fr))]"
                >
                  <div className="col-span-5 flex items-baseline justify-between gap-3 px-1 sm:col-span-1 sm:flex-col sm:justify-center sm:gap-0">
                    <span className="text-sm font-medium">
                      {t("week", { day: f.day(cohort.week) })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("size", { count: cohort.size })}
                    </span>
                  </div>
                  {[cohort.day1, ...cohort.weeks].map((value, index) => (
                    <div
                      key={index}
                      style={heat(value)}
                      className={cn(
                        "flex h-12 flex-col items-center justify-center rounded-xl text-center",
                        value === null && "bg-foreground/[0.03]",
                      )}
                    >
                      <span className="text-[0.65rem] text-muted-foreground sm:sr-only">
                        {columns[index]}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {f.percent(value)}
                      </span>
                    </div>
                  ))}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Panel>
      <Panel title={t("funnel")} description={t("funnelNote")}>
        {signedUp === 0 ? (
          <EmptyNote>{t("empty")}</EmptyNote>
        ) : (
          <ol aria-label={t("funnel")} className="flex flex-col gap-2">
            {data.funnel.map(({ step, count }, index) => {
              const previous = data.funnel[index - 1]?.count ?? 0;
              return (
                <li key={step} className="flex flex-col gap-2">
                  {index > 0 ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ArrowDown aria-hidden="true" className="size-3.5" />
                      {t("next", {
                        share: f.percent(
                          previous === 0 ? null : count / previous,
                        ),
                      })}
                    </p>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {t(`steps.${step}`)}
                    </span>
                    <span className="text-sm tabular-nums">
                      <span className="font-semibold">{f.number(count)}</span>{" "}
                      <span className="text-muted-foreground">
                        {f.percent(count / signedUp)}
                      </span>
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-2.5 overflow-hidden rounded-full bg-primary/12"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / signedUp) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">{tCommon("excluded")}</p>
    </div>
  );
}

export async function AiPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("ai");
  const [t, tCommon, data, f] = await Promise.all([
    getTranslations("Admin.ai"),
    getTranslations("Admin.common"),
    getAiUsage(period),
    formatters(),
  ]);
  const maxKind = Math.max(1, ...data.byKind.map((row) => row.requests));
  const proposals =
    data.proposals.applied + data.proposals.dismissed + data.proposals.pending;
  const kindName = (kind: string) => {
    const name = `kindNames.${kind}` as "kindNames.coach";
    return t.has(name) ? t(name) : kind;
  };

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/ai" period={period} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          icon={Sparkles}
          label={t("stats.requests")}
          value={f.number(data.requests)}
          trend={data.series.map((day) => day.requests)}
        />
        <KpiTile
          icon={Users}
          label={t("stats.users")}
          value={f.number(data.users)}
        />
        <KpiTile
          icon={Upload}
          label={t("stats.input")}
          value={f.compact(data.inputTokens)}
          hint={t("stats.cacheReadHint", {
            count: f.compact(data.cacheReadTokens),
          })}
        />
        <KpiTile
          icon={Download}
          label={t("stats.output")}
          value={f.compact(data.outputTokens)}
        />
      </div>
      {data.requests === 0 ? (
        <Panel title={t("chart")}>
          <EmptyNote>{t("empty")}</EmptyNote>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Panel title={t("chart")}>
            <DailyChart
              title={t("chart")}
              kind="bar"
              data={data.series.map(({ day, requests }) => ({
                day,
                value: requests,
              }))}
            />
          </Panel>
          <Panel title={t("kinds")}>
            <RankList
              label={t("kinds")}
              rows={data.byKind.map((row) => ({
                key: row.kind,
                label: kindName(row.kind),
                value: f.number(row.requests),
                ratio: row.requests / maxKind,
                details: [tCommon("users", { count: row.users })],
              }))}
            />
          </Panel>
        </div>
      )}
      {proposals > 0 ? (
        <Panel title={t("proposals")} description={t("proposalsNote")}>
          <ProposalBar
            summary={t("proposalsSummary", data.proposals)}
            parts={(["applied", "dismissed", "pending"] as const).map(
              (key) => ({
                key,
                label: t(`proposalStatus.${key}`),
                count: data.proposals[key],
                share: f.percent(data.proposals[key] / proposals),
                ratio: data.proposals[key] / proposals,
              }),
            )}
          />
        </Panel>
      ) : null}
      <p className="text-xs text-muted-foreground">{tCommon("excluded")}</p>
    </div>
  );
}

/** Une barre découpée : ajoutées (orange), écartées et en attente (gris). */
function ProposalBar({
  summary,
  parts,
}: {
  /** Les trois parts, pour les lecteurs d'écran. */
  summary: string;
  parts: readonly {
    key: "applied" | "dismissed" | "pending";
    label: string;
    count: number;
    share: string;
    ratio: number;
  }[];
}) {
  const fill = {
    applied: "bg-primary text-primary-foreground",
    dismissed: "bg-foreground/25 text-foreground",
    pending: "bg-foreground/10 text-foreground",
  } as const;
  const swatch = {
    applied: "bg-primary",
    dismissed: "bg-foreground/25",
    pending: "bg-foreground/10",
  } as const;
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={summary}
        className="flex h-7 gap-0.5 overflow-hidden rounded-lg"
      >
        {parts
          .filter((part) => part.count > 0)
          .map((part) => (
            <div
              key={part.key}
              style={{ flexGrow: part.ratio }}
              className={cn(
                "flex min-w-0 items-center rounded-md px-2 text-xs font-semibold",
                fill[part.key],
              )}
            >
              {part.ratio >= 0.12 ? part.share : null}
            </div>
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-full", swatch[part.key])}
            />
            {part.label}
            <span className="text-muted-foreground tabular-nums">
              {part.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function AuditPanel() {
  await openAdminPage("audit");
  const [t, entries, format] = await Promise.all([
    getTranslations("Admin.audit"),
    listAuditEntries(),
    getFormatter(),
  ]);
  if (entries.length === 0) {
    return (
      <Panel title={t("title")}>
        <EmptyNote>{t("empty")}</EmptyNote>
      </Panel>
    );
  }
  return (
    <Panel title={t("listTitle")} description={t("description")}>
      <ol className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3">
            <IconChip
              icon={entry.action === "sign_in" ? LogIn : Eye}
              size="sm"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="text-sm">
                <span className="font-medium">{entry.admin}</span>{" "}
                <span className="text-muted-foreground">
                  {entry.action === "sign_in"
                    ? t("signedIn")
                    : t("viewed", {
                        page:
                          entry.page &&
                          t.has(`pages.${entry.page}` as "pages.overview")
                            ? t(`pages.${entry.page}` as "pages.overview")
                            : "—",
                      })}
                </span>
              </span>
              <time
                dateTime={entry.at.toISOString()}
                className="text-xs text-muted-foreground tabular-nums"
              >
                {format.dateTime(entry.at, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: DASHBOARD_TIME_ZONE,
                })}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
