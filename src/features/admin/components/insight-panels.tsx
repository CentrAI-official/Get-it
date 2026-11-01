import {
  Bookmark,
  Bug,
  CalendarCheck,
  CircleHelp,
  Eye,
  Flame,
  Heart,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Repeat2,
  Smile,
  Target,
  TrendingUp,
  TriangleAlert,
  Type,
  Users,
  Video,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { DASHBOARD_TIME_ZONE, parsePeriod } from "@/features/analytics/rules";
import {
  getContent,
  getErrorsReport,
  getFeedbackReport,
  getOutcomes,
  type PostFormat,
} from "@/server/admin/insights";
import { openAdminPage } from "@/server/admin/audit";
import { cn } from "@/lib/utils";
import { formatters, PanelTop, type PanelProps } from "./dashboard-panels";
import { DailyChart } from "./daily-chart";
import {
  EmptyNote,
  IconChip,
  KpiTile,
  Meter,
  Panel,
  RankList,
} from "./dashboard-ui";

// Pages du dashboard au-delà de l'usage : résultats, contenu, avis et erreurs.
// Chaque panneau revérifie l'accès (et l'inscrit au journal). À placer dans un <Suspense>.

const FORMAT_ICONS: Record<PostFormat, typeof Type> = {
  progress: TrendingUp,
  question: CircleHelp,
  video: Video,
  photo: ImageIcon,
  text: Type,
};

const FEEDBACK_ICONS = {
  idea: Lightbulb,
  problem: TriangleAlert,
  praise: Heart,
  week: Smile,
} as const;

export async function ResultsPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("results");
  const [t, tCommon, data, f] = await Promise.all([
    getTranslations("Admin.results"),
    getTranslations("Admin.common"),
    getOutcomes(period),
    formatters(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/results" period={period} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          icon={Target}
          label={t("tiles.goals")}
          value={f.number(data.goals.completed)}
          hint={t("tiles.goalsHint", { count: data.goals.archived })}
        />
        <KpiTile
          icon={Flame}
          label={t("tiles.habits")}
          value={f.percent(data.habits.keptRate)}
          hint={t("tiles.habitsHint", {
            kept: data.habits.kept,
            eligible: data.habits.eligible,
          })}
        />
        <KpiTile
          icon={CalendarCheck}
          label={t("tiles.tasks")}
          value={f.percent(data.tasks.doneRate)}
          hint={t("tiles.tasksHint", { count: data.tasks.overdue })}
        />
        <KpiTile
          icon={Users}
          label={t("tiles.pacts")}
          value={f.percent(data.pacts.successRate)}
          hint={t("tiles.pactsHint", { count: data.pacts.active })}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("goals.title")} description={t("goals.note")}>
          <Meter
            label={t("goals.rate")}
            value={f.percent(data.goals.successRate)}
            ratio={data.goals.successRate ?? 0}
            detail={t("goals.detail", {
              completed: data.goals.completed,
              archived: data.goals.archived,
            })}
          />
          <Facts
            facts={[
              [t("goals.created"), f.number(data.goals.created)],
              [t("goals.active"), f.number(data.goals.active)],
              [
                t("goals.median"),
                data.goals.medianDays === null
                  ? "—"
                  : t("days", { count: Math.round(data.goals.medianDays) }),
              ],
            ]}
          />
        </Panel>
        <Panel title={t("habits.title")} description={t("habits.note")}>
          <Meter
            label={t("habits.rate")}
            value={f.percent(data.habits.keptRate)}
            ratio={data.habits.keptRate ?? 0}
            detail={t("habits.detail", {
              kept: data.habits.kept,
              eligible: data.habits.eligible,
            })}
          />
          <Facts
            facts={[
              [t("habits.active"), f.number(data.habits.active)],
              [t("habits.archived"), f.number(data.habits.archived)],
              [t("habits.checks"), f.number(data.habits.checks)],
            ]}
          />
        </Panel>
        <Panel title={t("tasks.title")} description={t("tasks.note")}>
          <Meter
            label={t("tasks.rate")}
            value={f.percent(data.tasks.doneRate)}
            ratio={data.tasks.doneRate ?? 0}
            detail={t("tasks.detail", {
              done: data.tasks.doneOfCreated,
              created: data.tasks.created,
            })}
          />
          <Facts facts={[[t("tasks.overdue"), f.number(data.tasks.overdue)]]} />
        </Panel>
        <Panel title={t("pacts.title")} description={t("pacts.note")}>
          <Meter
            label={t("pacts.rate")}
            value={f.percent(data.pacts.successRate)}
            ratio={data.pacts.successRate ?? 0}
            detail={t("pacts.detail", {
              succeeded: data.pacts.succeeded,
              ended: data.pacts.ended,
            })}
          />
          <Facts facts={[[t("pacts.active"), f.number(data.pacts.active)]]} />
        </Panel>
      </div>
      <p className="text-xs text-muted-foreground">{tCommon("excluded")}</p>
    </div>
  );
}

/** Quelques chiffres sous une jauge. */
function Facts({ facts }: { facts: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid grid-cols-3 gap-3 border-t border-foreground/6 pt-4">
      {facts.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function ContentPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("content");
  const [t, tCommon, data, f, format] = await Promise.all([
    getTranslations("Admin.content"),
    getTranslations("Admin.common"),
    getContent(period),
    formatters(),
    getFormatter(),
  ]);
  const maxFormat = Math.max(1, ...data.formats.map((row) => row.perPost));
  const maxAuthor = Math.max(1, ...data.authors.map((row) => row.score));

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/content" period={period}>
        {t("posts", { count: data.posts })}
      </PanelTop>
      <Panel title={t("top")} description={t("topNote")}>
        {data.top.length === 0 ? (
          <EmptyNote>{t("empty")}</EmptyNote>
        ) : (
          <ol className="flex flex-col gap-5">
            {data.top.map((post) => (
              <li key={post.id} className="flex gap-3">
                <IconChip icon={FORMAT_ICONS[post.format]} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="text-sm text-pretty">
                    {post.excerpt || t("noText")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {post.group
                      ? t("byInGroup", {
                          author: post.author,
                          group: post.group,
                          date: format.dateTime(post.createdAt, {
                            day: "numeric",
                            month: "short",
                            timeZone: DASHBOARD_TIME_ZONE,
                          }),
                        })
                      : t("by", {
                          author: post.author,
                          date: format.dateTime(post.createdAt, {
                            day: "numeric",
                            month: "short",
                            timeZone: DASHBOARD_TIME_ZONE,
                          }),
                        })}
                  </p>
                  <PostStats
                    empty={t("noReaction")}
                    stats={(
                      [
                        [Heart, "likes", post.likes],
                        [MessageSquare, "comments", post.comments],
                        [Bookmark, "saves", post.saves],
                        [Repeat2, "shares", post.shares],
                        [Eye, "views", post.views],
                      ] as const
                    )
                      // Seulement ce qui a eu lieu : pas de « 0 partage »
                      .filter(([, , value]) => value > 0)
                      .map(([icon, key, value]) => ({
                        key,
                        icon,
                        label: t(`stats.${key}`, { count: value }),
                      }))}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("formats")} description={t("formatsNote")}>
          <RankList
            label={t("formats")}
            rows={data.formats.map((row) => ({
              key: row.format,
              icon: FORMAT_ICONS[row.format],
              label: t(`formatNames.${row.format}`),
              value: f.minutes(row.perPost),
              ratio: row.perPost / maxFormat,
              muted: row.posts === 0,
              details: [t("posts", { count: row.posts })],
            }))}
          />
        </Panel>
        <Panel title={t("authors")} description={t("authorsNote")}>
          {data.authors.length === 0 ? (
            <EmptyNote>{t("empty")}</EmptyNote>
          ) : (
            <RankList
              label={t("authors")}
              rows={data.authors.map((row) => ({
                key: row.author,
                label: row.author,
                value: f.number(row.score),
                ratio: row.score / maxAuthor,
                details: [t("posts", { count: row.posts })],
              }))}
            />
          )}
        </Panel>
      </div>
      <p className="text-xs text-muted-foreground">{tCommon("excluded")}</p>
    </div>
  );
}

/** Les réactions d'une publication, ou « Aucune réaction ». */
function PostStats({
  stats,
  empty,
}: {
  stats: readonly { key: string; icon: typeof Heart; label: string }[];
  empty: string;
}) {
  if (stats.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {stats.map(({ key, icon: Icon, label }) => (
        <li key={key} className="flex items-center gap-1">
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </li>
      ))}
    </ul>
  );
}

export async function FeedbackPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("feedback");
  const [t, tTopics, data, f, format] = await Promise.all([
    getTranslations("Admin.feedback"),
    getTranslations("Feedback.week.topics"),
    getFeedbackReport(period),
    formatters(),
    getFormatter(),
  ]);
  const maxTopic = Math.max(1, ...data.topics.map((row) => row.count));
  const topicName = (topic: string) =>
    tTopics.has(topic as "community") ? tTopics(topic as "community") : topic;

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/feedback" period={period} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {(["idea", "problem", "praise", "week"] as const).map((kind) => (
          <KpiTile
            key={kind}
            icon={FEEDBACK_ICONS[kind]}
            label={t(`kinds.${kind}`)}
            value={f.number(data.counts[kind])}
          />
        ))}
      </div>
      <Panel
        title={t("topics")}
        description={t("topicsNote", { count: data.weekAnswers })}
      >
        {data.topics.length === 0 ? (
          <EmptyNote>{t("topicsEmpty")}</EmptyNote>
        ) : (
          <RankList
            label={t("topics")}
            rows={data.topics.map((row) => ({
              key: row.topic,
              label: topicName(row.topic),
              value: f.percent(row.count / data.weekAnswers),
              ratio: row.count / maxTopic,
              details: [t("answers", { count: row.count })],
            }))}
          />
        )}
      </Panel>
      <Panel title={t("entries")} description={t("entriesNote")}>
        {data.entries.length === 0 ? (
          <EmptyNote>{t("empty")}</EmptyNote>
        ) : (
          <ol className="flex flex-col gap-5">
            {data.entries.map((entry) => {
              const kind = (
                entry.kind in FEEDBACK_ICONS ? entry.kind : "idea"
              ) as keyof typeof FEEDBACK_ICONS;
              return (
                <li key={entry.id} className="flex gap-3">
                  <IconChip icon={FEEDBACK_ICONS[kind]} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                      {t("meta", {
                        kind: t(`kinds.${kind}`),
                        author: entry.author,
                        date: format.dateTime(entry.at, {
                          dateStyle: "medium",
                          timeZone: DASHBOARD_TIME_ZONE,
                        }),
                      })}
                    </p>
                    {entry.topic ? (
                      <p className="text-sm font-medium">
                        {t("helpsMost", { topic: topicName(entry.topic) })}
                      </p>
                    ) : null}
                    {entry.body ? (
                      <p className="text-sm text-pretty whitespace-pre-line">
                        {entry.body}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </div>
  );
}

export async function ErrorsPanel({ searchParams }: PanelProps) {
  const period = parsePeriod((await searchParams).p);
  await openAdminPage("errors");
  const [t, data, f, format] = await Promise.all([
    getTranslations("Admin.errors"),
    getErrorsReport(period),
    formatters(),
    getFormatter(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PanelTop href="/admin/errors" period={period} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <KpiTile
          icon={Bug}
          label={t("tiles.total")}
          value={f.number(data.total)}
          trend={data.series.map((day) => day.errors)}
        />
        <KpiTile
          icon={Users}
          label={t("tiles.people")}
          value={f.number(data.people)}
        />
        <KpiTile
          icon={TriangleAlert}
          label={t("tiles.routes")}
          value={f.number(data.routes)}
        />
      </div>
      {data.total === 0 ? (
        <Panel title={t("groups")}>
          <EmptyNote>{t("empty")}</EmptyNote>
        </Panel>
      ) : (
        <>
          <Panel title={t("chart")}>
            <DailyChart
              title={t("chart")}
              kind="bar"
              data={data.series.map(({ day, errors }) => ({
                day,
                value: errors,
              }))}
            />
          </Panel>
          <Panel title={t("groups")} description={t("groupsNote")}>
            <ol className="flex flex-col gap-4">
              {data.groups.map((group, index) => (
                <li
                  key={`${group.source}-${group.route}-${index}`}
                  className={cn(
                    "flex flex-col gap-1.5 pb-4",
                    index < data.groups.length - 1 &&
                      "border-b border-foreground/6",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium break-words">
                      {group.message}
                    </p>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {f.number(group.count)}
                    </span>
                  </div>
                  <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {t(
                        `sources.${group.source === "server" ? "server" : "client"}`,
                      )}
                    </span>
                    <span className="break-all">
                      {group.route ?? t("unknownRoute")}
                    </span>
                    <span>{t("people", { count: group.people })}</span>
                    <span>
                      {t("lastSeen", {
                        date: format.dateTime(group.lastAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: DASHBOARD_TIME_ZONE,
                        }),
                      })}
                    </span>
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </>
      )}
    </div>
  );
}
