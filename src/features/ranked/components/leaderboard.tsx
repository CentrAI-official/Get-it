import { Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getCommunityMember } from "@/server/community/members";
import { getCurrentProfile } from "@/server/profile/service";
import {
  getLeaderboard,
  type LeaderboardRow,
} from "@/server/ranked/leaderboard";
import { getRankedLevels } from "@/server/ranked/service";
import {
  LEADERBOARD_PILLARS,
  LEADERBOARD_SCOPES,
  leaderboardFiltersSchema,
  type LeaderboardPillar,
  type LeaderboardScope,
} from "../leaderboard";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const chip =
  "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground";

/** Classement Ranked : toutes les personnes classées, ou mes contacts. Lit la session. */
export async function LeaderboardPanel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const params = await searchParams;
  const filters = leaderboardFiltersSchema.parse({
    pillar: one(params.pillar),
    scope: one(params.scope),
  });
  const [board, ranked, t] = await Promise.all([
    getLeaderboard(profile.id, filters.pillar, filters.scope),
    getRankedLevels(profile.id),
    getTranslations("Ranked.leaderboard"),
  ]);
  const href = (pillar: LeaderboardPillar, scope: LeaderboardScope) => {
    const query = new URLSearchParams();
    if (pillar !== "total") query.set("pillar", pillar);
    if (scope !== "all") query.set("scope", scope);
    const value = query.toString();
    return `/profile/ranked/leaderboard${value ? `?${value}` : ""}`;
  };
  const mineShown = board.rows.some((row) => row.mine);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("pillarsLabel")} className="flex flex-wrap gap-2">
        {LEADERBOARD_PILLARS.map((pillar) => (
          <Link
            key={pillar}
            href={href(pillar, filters.scope)}
            aria-current={pillar === filters.pillar ? "page" : undefined}
            className={cn(chip, pillar === filters.pillar ? chipOn : chipOff)}
          >
            {t(`pillars.${pillar}`)}
          </Link>
        ))}
      </nav>
      <nav aria-label={t("scopesLabel")} className="flex flex-wrap gap-2">
        {LEADERBOARD_SCOPES.map((scope) => (
          <Link
            key={scope}
            href={href(filters.pillar, scope)}
            aria-current={scope === filters.scope ? "page" : undefined}
            className={cn(chip, scope === filters.scope ? chipOn : chipOff)}
          >
            {t(`scopes.${scope}`)}
          </Link>
        ))}
      </nav>

      {ranked ? null : (
        <div className="flex flex-col items-start gap-3 border-t border-foreground/8 pt-6">
          <p className="text-sm text-muted-foreground">{t("notRanked")}</p>
          <Button asChild>
            <Link href="/profile/ranked">
              <Trophy aria-hidden="true" />
              {t("notRankedCta")}
            </Link>
          </Button>
        </div>
      )}

      <section
        aria-labelledby="leaderboard-list"
        className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
      >
        <h2 id="leaderboard-list" className="caps-label text-muted-foreground">
          {t("count", { count: board.count })}
        </h2>
        {board.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filters.scope === "contacts" ? t("emptyContacts") : t("empty")}
          </p>
        ) : (
          <ol className="flex flex-col">
            {board.rows.map((row) => (
              <Row key={row.person.id} row={row} />
            ))}
          </ol>
        )}
        {board.mine && !mineShown ? (
          <ol className="flex flex-col border-t border-dashed border-foreground/15 pt-2">
            <Row row={board.mine} />
          </ol>
        ) : null}
      </section>
    </div>
  );
}

async function Row({ row }: { row: LeaderboardRow }) {
  const t = await getTranslations("Ranked.leaderboard");
  const name = row.person.displayName ?? row.person.username;
  return (
    <li
      className={cn(
        "-mx-3 border-b border-foreground/8 px-3 last:border-b-0",
        row.mine && "rounded-2xl border-b-0 bg-primary/10",
      )}
    >
      <Link
        href={`/community/members/${row.person.username}`}
        className="flex items-center gap-3 rounded-2xl py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "w-10 shrink-0 text-center font-display text-xl",
            row.rank <= 3 ? "text-primary" : "text-muted-foreground",
          )}
        >
          <span className="sr-only">{t("rankLabel", { rank: row.rank })}</span>
          <span aria-hidden="true">{row.rank}</span>
        </span>
        <Avatar
          name={name}
          url={row.person.avatarUrl}
          className="size-10 shrink-0"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">
            {name}
            {row.mine ? (
              <span className="ml-1.5 text-xs font-medium text-primary">
                {t("you")}
              </span>
            ) : null}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            @{row.person.username}
          </span>
        </span>
        <span className="shrink-0 font-display text-2xl">
          <span className="sr-only">
            {t("levelLabel", { level: row.level })}
          </span>
          <span aria-hidden="true">{row.level}</span>
        </span>
      </Link>
    </li>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-72 max-w-full rounded-full" />
      <Skeleton className="h-9 w-56 max-w-full rounded-full" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-14 rounded-2xl" />
      ))}
    </div>
  );
}
