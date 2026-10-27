import { ChevronRight, MessagesSquare, Search, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityFeed } from "@/features/community/components/community-feed";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { PostComposer } from "@/features/community/components/post-composer";
import { recordIdSchema } from "@/features/goals/schemas";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listFeed } from "@/server/community/feed";
import { getCommunityMember } from "@/server/community/members";
import {
  getGroup,
  listGroupMembers,
  listMyGroups,
  listPublicGroups,
  type GroupSummary,
} from "@/server/groups/service";
import { avatarUrl } from "@/server/profile/avatar";
import { getCurrentProfile } from "@/server/profile/service";
import { storageEnabled } from "@/server/storage/service";
import { canManage, GROUP_TOPICS, groupFiltersSchema } from "../rules";
import { GroupBadge } from "./group-badge";
import {
  DeleteGroupButton,
  InvitationButtons,
  InviteDialog,
  JoinGroupButton,
  LeaveGroupButton,
  MemberMenu,
} from "./group-buttons";
import { GroupForm } from "./group-form";

// Pages des Groupes. Chacune lit la session : à placer dans un <Suspense>.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const chip =
  "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Ligne d'un groupe : pastille, nom, type et membres. */
async function GroupRow({
  group,
  action,
}: {
  group: GroupSummary;
  action?: ReactNode;
}) {
  const t = await getTranslations("Groups");
  return (
    <li className="flex items-center gap-3 border-b border-white/8 py-3">
      <Link
        href={`/groups/${group.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <GroupBadge topic={group.topic} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold break-words">{group.name}</span>
          <span className="text-sm text-muted-foreground">
            {t(`topics.${group.topic}`)} · {t(`visibility.${group.visibility}`)}{" "}
            · {t("members", { count: group.memberCount })}
            {group.role && group.role !== "member"
              ? ` · ${t(`roles.${group.role}`)}`
              : ""}
          </span>
        </span>
        {action ? null : (
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
      </Link>
      {action}
    </li>
  );
}

/** Accueil des Groupes : invitations, mes groupes, puis l'annuaire des groupes publics. */
export async function GroupsPanel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const params = await searchParams;
  const filters = groupFiltersSchema.parse({
    topic: one(params.topic),
    q: one(params.q),
  });
  const [mine, discover, t] = await Promise.all([
    listMyGroups(profile.id),
    listPublicGroups(profile.id, filters),
    getTranslations("Groups"),
  ]);
  const others = discover.filter((group) => group.status !== "active");
  const topicHref = (topic?: string) => {
    const query = new URLSearchParams();
    if (topic) query.set("topic", topic);
    if (filters.q) query.set("q", filters.q);
    const value = query.toString();
    return value ? `/groups?${value}` : "/groups";
  };

  return (
    <div className="flex flex-col gap-8">
      <Button asChild className="w-fit">
        <Link href="/groups/new">
          <UsersRound aria-hidden="true" />
          {t("create")}
        </Link>
      </Button>

      {mine.invitations.length > 0 ? (
        <section
          aria-labelledby="groups-invitations"
          className="flex flex-col gap-2 border-t border-white/8 pt-6"
        >
          <h2
            id="groups-invitations"
            className="font-heading text-lg font-bold"
          >
            {t("invitations.title")}
          </h2>
          <ul className="flex flex-col">
            {mine.invitations.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                action={<InvitationButtons groupId={group.id} />}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="groups-mine"
        className="flex flex-col gap-2 border-t border-white/8 pt-6"
      >
        <h2 id="groups-mine" className="font-heading text-lg font-bold">
          {t("mine.title")}
        </h2>
        {mine.groups.length > 0 ? (
          <ul className="flex flex-col">
            {mine.groups.map((group) => (
              <GroupRow key={group.id} group={group} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("mine.empty")}</p>
        )}
      </section>

      <section
        aria-labelledby="groups-discover"
        className="flex flex-col gap-4 border-t border-white/8 pt-6"
      >
        <h2 id="groups-discover" className="font-heading text-lg font-bold">
          {t("discover.title")}
        </h2>
        <form role="search" className="flex gap-2">
          {filters.topic ? (
            <input type="hidden" name="topic" value={filters.topic} />
          ) : null}
          <label htmlFor="groups-search" className="sr-only">
            {t("discover.searchLabel")}
          </label>
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="groups-search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={t("discover.searchPlaceholder")}
              maxLength={60}
              className="h-10 w-full rounded-full border border-white/12 bg-white/[0.03] pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            {t("discover.search")}
          </Button>
        </form>
        <nav
          aria-label={t("discover.topicsLabel")}
          className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {[undefined, ...GROUP_TOPICS].map((topic) => {
            const active = filters.topic === topic;
            return (
              <Link
                key={topic ?? "all"}
                href={topicHref(topic)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  chip,
                  active
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {topic ? t(`topics.${topic}`) : t("discover.all")}
              </Link>
            );
          })}
        </nav>
        {others.length > 0 ? (
          <ul className="flex flex-col">
            {others.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                action={<JoinGroupButton groupId={group.id} size="sm" />}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("discover.empty")}</p>
        )}
      </section>
    </div>
  );
}

/** Page d'un groupe : en-tête, actions, membres, puis forum (public) ou discussion (privé). */
export async function GroupPageLoader({ groupId }: { groupId: string }) {
  if (!recordIdSchema.safeParse(groupId).success) notFound();
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const [group, t] = await Promise.all([
    getGroup(profile.id, groupId),
    getTranslations("Groups"),
  ]);
  if (!group) {
    return (
      <EmptyState
        icon={UsersRound}
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
      />
    );
  }
  const active = group.status === "active";
  const manager = active && canManage(group.role);
  const [members, feed, myAvatar] = await Promise.all([
    listGroupMembers(profile.id, group.id),
    group.visibility === "public"
      ? listFeed(profile.id, undefined, undefined, group.id)
      : null,
    avatarUrl(profile.avatarPath),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <GroupBadge topic={group.topic} className="size-16" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-heading text-2xl leading-tight font-bold text-balance break-words sm:text-3xl">
              {group.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(`topics.${group.topic}`)} ·{" "}
              {t(`visibility.${group.visibility}`)} ·{" "}
              {t("members", { count: group.memberCount })}
            </p>
          </div>
        </div>
        {group.description ? (
          <p className="text-pretty whitespace-pre-line text-muted-foreground">
            {group.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {group.status === "invited" ? (
            <InvitationButtons groupId={group.id} />
          ) : null}
          {!group.status && group.visibility === "public" ? (
            <JoinGroupButton groupId={group.id} />
          ) : null}
          {active && group.conversationId ? (
            <Button asChild>
              <Link href={`/messages/${group.conversationId}`}>
                <MessagesSquare aria-hidden="true" />
                {t("openChat")}
              </Link>
            </Button>
          ) : null}
          {manager ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/groups/${group.id}/edit`}>{t("edit")}</Link>
            </Button>
          ) : null}
          {manager && group.visibility === "private" ? (
            <InviteDialog groupId={group.id} />
          ) : null}
        </div>
      </header>

      {group.visibility === "public" ? (
        <section
          aria-labelledby="group-forum"
          className="flex flex-col gap-4 border-t border-white/8 pt-6"
        >
          <h2 id="group-forum" className="font-heading text-lg font-bold">
            {t("forum.title")}
          </h2>
          {active && !member.suspendedUntil ? (
            <PostComposer
              shareable={[]}
              preselected={null}
              name={profile.displayName ?? member.username ?? ""}
              avatarUrl={myAvatar}
              mediaEnabled={storageEnabled()}
              groupId={group.id}
            />
          ) : !active ? (
            <p className="text-sm text-muted-foreground">
              {t("forum.joinToPost")}
            </p>
          ) : null}
          {feed ? (
            <CommunityFeed
              // Une nouvelle publication recharge le forum
              key={feed.posts[0]?.id ?? "empty"}
              initialPosts={feed.posts}
              initialCursor={feed.nextCursor}
              now={feed.loadedAt}
              canWrite={!member.suspendedUntil}
              groupId={group.id}
              groupManager={manager}
              empty={{
                title: t("forum.emptyTitle"),
                description: t("forum.emptyDescription"),
              }}
            />
          ) : null}
        </section>
      ) : active ? (
        <section className="flex flex-col gap-2 border-t border-white/8 pt-6">
          <h2 className="font-heading text-lg font-bold">{t("chat.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("chat.description")}
          </p>
        </section>
      ) : null}

      {members ? (
        <section
          aria-labelledby="group-members"
          className="flex flex-col gap-2 border-t border-white/8 pt-6"
        >
          <h2 id="group-members" className="font-heading text-lg font-bold">
            {t("memberList.title")}
          </h2>
          <ul className="flex flex-col">
            {members.map(({ person, role, status }) => {
              const name = person.displayName ?? person.username ?? "";
              return (
                <li
                  key={person.id}
                  className="flex items-center gap-3 border-b border-white/8 py-2.5"
                >
                  <Avatar
                    name={name}
                    url={person.avatarUrl}
                    className="size-9"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">
                      {name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      @{person.username ?? ""} ·{" "}
                      {status === "invited"
                        ? t("memberList.invited")
                        : t(`roles.${role}`)}
                    </span>
                  </span>
                  {manager && group.role && person.id !== profile.id ? (
                    <MemberMenu
                      groupId={group.id}
                      userId={person.id}
                      name={name}
                      role={role}
                      viewerRole={group.role}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {active ? (
        <div className="flex flex-col gap-2 border-t border-white/8 pt-6">
          {group.role === "owner" ? (
            <DeleteGroupButton groupId={group.id} />
          ) : (
            <LeaveGroupButton groupId={group.id} />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Formulaire de modification : le créateur et les admins seulement. */
export async function GroupEditLoader({ groupId }: { groupId: string }) {
  if (!recordIdSchema.safeParse(groupId).success) notFound();
  const profile = await getCurrentProfile();
  const group = await getGroup(profile.id, groupId);
  if (!group || group.status !== "active" || !canManage(group.role)) notFound();
  return (
    <GroupForm
      group={{
        id: group.id,
        name: group.name,
        description: group.description,
        topic: group.topic,
        visibility: group.visibility,
      }}
    />
  );
}

export function GroupsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-44 rounded-full" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
