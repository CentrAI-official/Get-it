import {
  Check,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  HeartHandshake,
  Lock,
  Trophy,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileLink } from "@/components/profile-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLogo } from "@/features/pages/components/page-logo";
import { recordIdSchema } from "@/features/goals/schemas";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  getClientFile,
  listMyPros,
  listPageClients,
  myPlanKinds,
  myRelationWith,
  type ClientPlanView,
  type PageClientItem,
} from "@/server/clients/service";
import { getActingPage } from "@/server/pages/identity";
import { getCurrentProfile } from "@/server/profile/service";
import { CLIENT_LIMITS, type ShareableKind } from "../rules";
import {
  CancelInvitationButton,
  DeclineInvitationButton,
  DeleteNoteButton,
  EndClientButton,
  InviteClientButton,
  LeaveProButton,
  NoteComposer,
  RequestAnswerButtons,
  RequestClientButton,
  SharesDialogButton,
  WriteToClientButton,
} from "./client-forms";

// Les clients d'une page pro (lot 3). Chaque vue lit la session : à placer
// dans un <Suspense>.

const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** « Plan d'entraînement et plan de nutrition », ou « aucun plan ». */
async function sharesText(kinds: readonly ShareableKind[]) {
  const [t, tKinds, format] = await Promise.all([
    getTranslations("Clients"),
    getTranslations("Development.kinds"),
    getFormatter(),
  ]);
  return kinds.length === 0
    ? t("sharesNone")
    : t("sharesList", {
        list: format.list(
          kinds.map((kind) => tKinds(`${kind}.title`)),
          { type: "conjunction" },
        ),
      });
}

// ——— Sur sa page : la liste des clients ———

/** Clients (mode page, à la place de Mon développement). */
export async function ClientsHome() {
  const profile = await getCurrentProfile();
  const page = await getActingPage(profile.id);
  if (!page) notFound();
  const [items, t, format] = await Promise.all([
    listPageClients(profile.id, page.id),
    getTranslations("Clients"),
    getFormatter(),
  ]);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "long" });
  const by = (status: PageClientItem["status"]) =>
    items.filter((item) => item.status === status);
  const requests = by("requested");
  const clients = by("active");
  const invited = by("invited");
  const former = by("ended");
  const shares = new Map(
    await Promise.all(
      items.map(
        async (item) => [item.id, await sharesText(item.sharedKinds)] as const,
      ),
    ),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <PageHeader title={t("title")} description={t("question")} />
        <div className="flex flex-col gap-2">
          <InviteClientButton />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("home.emptyTitle")}
          description={t("home.emptyDescription")}
        />
      ) : null}

      {requests.length > 0 ? (
        <section
          aria-labelledby="clients-requests"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h2
            id="clients-requests"
            className="caps-label text-muted-foreground"
          >
            {t("home.requests", { count: requests.length })}
          </h2>
          <ul className="flex flex-col">
            {requests.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 border-b border-foreground/8 py-4"
              >
                <PersonLine
                  item={item}
                  detail={t("home.requested", { date: date(item.since) })}
                />
                {item.message ? (
                  <p className="text-sm break-words whitespace-pre-line">
                    {t("home.message", { message: item.message })}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {shares.get(item.id)}
                </p>
                <RequestAnswerButtons relationId={item.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {clients.length > 0 ? (
        <section
          aria-labelledby="clients-active"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h2 id="clients-active" className="caps-label text-muted-foreground">
            {t("home.clients", { count: clients.length })}
          </h2>
          <ul className="flex flex-col">
            {clients.map((item) => (
              <li key={item.id} className="border-b border-foreground/8">
                <Link
                  href={`/clients/${item.client.id}`}
                  className="flex min-h-16 items-center gap-3 py-3 outline-none hover:bg-foreground/[0.03] focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Avatar
                    name={item.client.displayName ?? item.client.username ?? ""}
                    url={item.client.avatarUrl}
                    className="size-11"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {item.client.displayName ?? item.client.username}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t("home.since", { date: date(item.since) })} ·{" "}
                      {shares.get(item.id)}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {invited.length > 0 ? (
        <section
          aria-labelledby="clients-invited"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h2 id="clients-invited" className="caps-label text-muted-foreground">
            {t("home.invited")}
          </h2>
          <ul className="flex flex-col">
            {invited.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/8 py-3"
              >
                <PersonLine
                  item={item}
                  detail={t("home.invitedOn", { date: date(item.since) })}
                />
                <CancelInvitationButton relationId={item.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {former.length > 0 ? (
        <section
          aria-labelledby="clients-former"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h2 id="clients-former" className="caps-label text-muted-foreground">
            {t("home.former")}
          </h2>
          <ul className="flex flex-col">
            {former.map((item) => (
              <li key={item.id} className="border-b border-foreground/8">
                <Link
                  href={`/clients/${item.client.id}`}
                  className="flex min-h-14 items-center gap-3 py-2 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <PersonLine
                    item={item}
                    detail={t("home.endedOn", {
                      date: date(item.endedAt ?? item.since),
                    })}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PersonLine({
  item,
  detail,
}: {
  item: PageClientItem;
  detail: string;
}) {
  const name = item.client.displayName ?? item.client.username ?? "";
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={name} url={item.client.avatarUrl} className="size-10" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </span>
  );
}

// ——— La fiche d'un client ———

export async function ClientFileView({ clientId }: { clientId: string }) {
  const id = recordIdSchema.safeParse(clientId);
  if (!id.success) notFound();
  const profile = await getCurrentProfile();
  const page = await getActingPage(profile.id);
  if (!page) notFound();
  const file = await getClientFile(profile.id, page.id, id.data);
  if (!file) notFound();
  const [t, tKinds, format] = await Promise.all([
    getTranslations("Clients"),
    getTranslations("Development.kinds"),
    getFormatter(),
  ]);
  const name = file.client.displayName ?? file.client.username ?? "";
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const status =
    file.status === "active"
      ? t("file.since", { date: date(file.since) })
      : file.status === "ended"
        ? t("home.endedOn", { date: date(file.endedAt ?? file.since) })
        : file.status === "invited"
          ? t("home.invitedOn", { date: date(file.since) })
          : t("home.requested", { date: date(file.since) });
  const missing = file.sharedKinds.filter(
    (kind) => !file.plans.some((plan) => plan.kind === kind),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <ProfileLink
          username={file.client.username}
          className="flex w-fit items-center gap-4"
        >
          <Avatar
            name={name}
            url={file.client.avatarUrl}
            className="size-16 text-xl"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words">
              {name}
            </h1>
            {file.client.username ? (
              <span className="text-sm text-muted-foreground">
                @{file.client.username}
              </span>
            ) : null}
          </span>
        </ProfileLink>
        <p className="text-sm text-muted-foreground">{status}</p>
        {file.status === "active" ? (
          <div className="flex flex-wrap items-start gap-2">
            <WriteToClientButton clientId={file.client.id} />
            <EndClientButton relationId={file.relationId} name={name} />
          </div>
        ) : null}
      </header>

      {file.status === "active" ? (
        <section
          aria-labelledby="client-shared"
          className="flex flex-col gap-5 border-t border-foreground/8 pt-6"
        >
          <h2 id="client-shared" className="caps-label text-muted-foreground">
            {t("file.shared", { name })}
          </h2>
          {file.sharedKinds.length === 0 ? (
            <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("file.nothingShared", { name })}
            </p>
          ) : null}
          {file.plans.map((plan) => (
            <ClientPlan key={plan.kind} plan={plan} />
          ))}
          {missing.map((kind) => (
            <p key={kind} className="text-sm text-muted-foreground">
              {t("file.noPlan", { plan: tKinds(`${kind}.title`), name })}
            </p>
          ))}
        </section>
      ) : null}

      <section
        aria-labelledby="client-notes"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="client-notes" className="caps-label text-muted-foreground">
            {t("file.notes")}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("notes.count", {
              count: file.notes.length,
              max: CLIENT_LIMITS.notesPerClient,
            })}
          </span>
        </div>
        <p className="flex items-start gap-2 text-xs text-pretty text-muted-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {t("file.notesHint", { name })}
        </p>
        {/* Une note : pendant le suivi ou après, pas sur une simple invitation */}
        {file.status === "active" || file.status === "ended" ? (
          <NoteComposer clientId={file.client.id} />
        ) : null}
        {file.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("file.noNotes")}</p>
        ) : (
          <ul className="flex flex-col">
            {file.notes.map((note) => (
              <li
                key={note.id}
                className="flex items-start gap-2 border-b border-foreground/8 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <time
                    dateTime={note.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {format.dateTime(new Date(note.createdAt), {
                      day: "numeric",
                      month: "long",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  <p className="text-sm break-words whitespace-pre-line">
                    {note.body}
                  </p>
                </div>
                <DeleteNoteButton noteId={note.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Un plan partagé, en lecture seule : la semaine en cours et ce qui est fait. */
async function ClientPlan({ plan }: { plan: ClientPlanView }) {
  const [t, tKinds, format] = await Promise.all([
    getTranslations("Clients.file"),
    getTranslations("Development.kinds"),
    getFormatter(),
  ]);
  const scheduled = plan.days.filter((day) => day.session);
  const doneCount = scheduled.reduce(
    (sum, day) =>
      sum +
      (plan.kind === "physical"
        ? day.workout
          ? 1
          : 0
        : (day.session?.items.filter((item) => item.done).length ?? 0)),
    0,
  );
  const total =
    plan.kind === "physical"
      ? scheduled.length
      : scheduled.reduce(
          (sum, day) => sum + (day.session?.items.length ?? 0),
          0,
        );
  return (
    <article className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-semibold text-primary uppercase">
          {tKinds(`${plan.kind}.title`)}
        </p>
        <h3 className="font-heading text-lg font-bold break-words">
          {plan.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {plan.week
            ? t("week", { week: plan.week.week, weeks: plan.week.weeks })
            : null}
          {plan.week ? " · " : null}
          {t(plan.kind === "physical" ? "sessionsDone" : "itemsDone", {
            done: doneCount,
            total,
          })}
        </p>
      </div>
      <ol className="flex flex-col">
        {plan.days.map((day) => (
          <li
            key={day.day}
            className={cn(
              "flex gap-3 border-b border-foreground/8 py-2.5",
              day.today && "bg-primary/[0.04]",
            )}
          >
            <span
              className={cn(
                "w-14 shrink-0 text-xs font-semibold tabular-nums",
                day.today ? "text-primary" : "text-muted-foreground",
              )}
            >
              {format.dateTime(dayDate(day.day), {
                weekday: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </span>
            {day.session ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm font-semibold break-words">
                  {day.session.title}
                </p>
                {plan.kind === "physical" ? (
                  day.workout ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Dumbbell aria-hidden="true" className="size-3.5" />
                      {t("workout", {
                        minutes: day.workout.minutes,
                        sets: day.workout.sets,
                      })}
                    </p>
                  ) : null
                ) : null}
                <ul className="flex flex-col gap-0.5">
                  {day.session.items.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs">
                      {/* L'entraînement se note dans le carnet (la séance), pas exercice par exercice */}
                      {plan.kind === "physical" ? (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/40"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                            item.done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-foreground/25",
                          )}
                        >
                          {item.done ? (
                            <Check className="size-2.5" strokeWidth={3} />
                          ) : null}
                        </span>
                      )}
                      <span className="min-w-0 break-words">
                        {plan.kind === "physical" ? null : (
                          <span className="sr-only">
                            {item.done ? t("done") : t("notDone")}
                          </span>
                        )}
                        {item.name}
                        {item.replacedBy
                          ? ` · ${t("replaced", { food: item.replacedBy })}`
                          : null}
                        {item.outcome
                          ? ` · ${t(`outcome.${item.outcome as 1 | 2 | 3}`)}`
                          : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {day.workout
                  ? t("workout", {
                      minutes: day.workout.minutes,
                      sets: day.workout.sets,
                    })
                  : t(plan.kind === "physical" ? "rest" : "nothing")}
              </p>
            )}
          </li>
        ))}
      </ol>
      {plan.recent.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground">
            {t("recent")}
          </h4>
          <ul className="flex flex-col gap-1">
            {plan.recent.map((workout) => (
              <li
                key={`${workout.day}-${workout.title}`}
                className="flex flex-wrap items-center gap-x-2 text-xs"
              >
                <span className="text-muted-foreground tabular-nums">
                  {format.dateTime(dayDate(workout.day), {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </span>
                <span className="font-medium">{workout.title}</span>
                <span className="text-muted-foreground">
                  {t("workout", {
                    minutes: workout.minutes,
                    sets: workout.sets,
                  })}
                </span>
                {workout.records > 0 ? (
                  <span className="flex items-center gap-1 font-medium text-primary">
                    <Trophy aria-hidden="true" className="size-3" />
                    {t("records", { count: workout.records })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

// ——— Côté client ———

/** Mes pros (Profil) : invitations, demandes et suivis, et ce que je partage. */
export async function MyPros() {
  const profile = await getCurrentProfile();
  const [items, kinds, t, format] = await Promise.all([
    listMyPros(profile.id),
    myPlanKinds(profile.id),
    getTranslations("Clients"),
    getFormatter(),
  ]);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "long" });
  if (items.length === 0) {
    return (
      <EmptyState
        icon={HeartHandshake}
        title={t("pros.emptyTitle")}
        description={t("pros.emptyDescription")}
        action={
          <Button asChild>
            <Link href="/marketplace">{t("pros.browse")}</Link>
          </Button>
        }
      />
    );
  }
  const shares = new Map(
    await Promise.all(
      items.map(
        async (item) => [item.id, await sharesText(item.sharedKinds)] as const,
      ),
    ),
  );
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 border-b border-foreground/8 py-4"
        >
          <Link
            href={`/pages/${item.page.handle}`}
            className="flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PageLogo
              name={item.page.name}
              url={item.page.logoUrl}
              className="size-11 text-lg"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{item.page.name}</span>
              <span className="text-xs text-muted-foreground">
                {item.status === "invited"
                  ? t("pros.invited", { date: date(item.since) })
                  : item.status === "requested"
                    ? t("pros.waiting")
                    : t("pros.since", { date: date(item.since) })}
              </span>
            </span>
          </Link>
          {item.status === "invited" && item.message ? (
            <p className="text-sm break-words whitespace-pre-line">
              {t("home.message", { message: item.message })}
            </p>
          ) : null}
          {item.status === "invited" ? null : (
            <p className="text-sm text-muted-foreground">
              {shares.get(item.id)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {item.status === "invited" ? (
              <>
                <SharesDialogButton
                  relationId={item.id}
                  pageName={item.page.name}
                  planKinds={kinds}
                  initial={{ kinds: [], mentalConsent: false }}
                  mode="accept"
                />
                <DeclineInvitationButton
                  relationId={item.id}
                  pageName={item.page.name}
                />
              </>
            ) : (
              <>
                <SharesDialogButton
                  relationId={item.id}
                  pageName={item.page.name}
                  planKinds={kinds}
                  initial={{
                    kinds: item.sharedKinds,
                    mentalConsent: item.mentalConsent,
                  }}
                  mode="edit"
                />
                <LeaveProButton
                  relationId={item.id}
                  pageName={item.page.name}
                  requested={item.status === "requested"}
                />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Dans l'Aperçu du Profil : « Mes pros », seulement si on en a (ou une
 * invitation en attente).
 */
export async function ProsLink() {
  const profile = await getCurrentProfile();
  const [items, t] = await Promise.all([
    listMyPros(profile.id),
    getTranslations("Clients.pros"),
  ]);
  if (items.length === 0) return null;
  const invitations = items.filter((item) => item.status === "invited").length;
  return (
    <Link
      href="/profile/pros"
      className="flex min-h-14 items-center gap-3 rounded-2xl bg-foreground/[0.05] p-3 outline-none hover:bg-foreground/[0.08] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <HeartHandshake
        aria-hidden="true"
        className="size-5 shrink-0 text-primary"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{t("title")}</span>
        <span
          className={cn(
            "text-xs",
            invitations > 0
              ? "font-medium text-primary"
              : "text-muted-foreground",
          )}
        >
          {invitations > 0
            ? t("invitations", { count: invitations })
            : t("count", { count: items.length })}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 text-muted-foreground"
      />
    </Link>
  );
}

/** Sur la page publique d'un pro : « Devenir client », ou où en est le suivi. */
export async function ClientRequestArea({
  pageId,
  pageName,
}: {
  pageId: string;
  pageName: string;
}) {
  const profile = await getCurrentProfile();
  const [relation, kinds, t] = await Promise.all([
    myRelationWith(profile.id, pageId),
    myPlanKinds(profile.id),
    getTranslations("Clients.request"),
  ]);
  if (!relation) {
    return (
      <RequestClientButton
        pageId={pageId}
        pageName={pageName}
        planKinds={kinds}
      />
    );
  }
  return (
    <Link
      href="/profile/pros"
      className="identity-personal flex min-h-11 items-center gap-2 rounded-lg border border-foreground/12 px-4 text-sm font-medium outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <HeartHandshake aria-hidden="true" className="size-4 text-primary" />
      {relation.status === "active"
        ? t("client")
        : relation.status === "requested"
          ? t("sent")
          : t("invited", { page: pageName })}
    </Link>
  );
}

export function ClientsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-11 w-44 rounded-lg" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
