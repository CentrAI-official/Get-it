import { Info, Minus, Plus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageLogo } from "@/features/pages/components/page-logo";
import { recordIdSchema } from "@/features/goals/schemas";
import { Link } from "@/i18n/navigation";
import { getPlanEditor, getProposal } from "@/server/clients/proposals";
import { getActingPage } from "@/server/pages/identity";
import { getCurrentProfile } from "@/server/profile/service";
import type { DayChange } from "../proposals";
import { SHAREABLE_KINDS } from "../rules";
import { PlanEditor, ProposalAnswerButtons } from "./plan-editor";

// Modifications de plan (lot 4). Chaque vue lit la session : à placer dans un
// <Suspense>.

const isShareable = (kind: string) =>
  SHAREABLE_KINDS.find((entry) => entry === kind) ?? null;

/** Sur sa page : modifier la semaine type d'un plan qu'un client montre. */
export async function ClientPlanEditorView({
  clientId,
  kind,
}: {
  clientId: string;
  kind: string;
}) {
  const id = recordIdSchema.safeParse(clientId);
  const planKind = isShareable(kind);
  if (!id.success || !planKind) notFound();
  const profile = await getCurrentProfile();
  const page = await getActingPage(profile.id);
  if (!page) notFound();
  const editor = await getPlanEditor(profile.id, page.id, id.data, planKind);
  if (!editor) notFound();
  const [t, tKinds] = await Promise.all([
    getTranslations("Clients.proposals"),
    getTranslations("Development.kinds"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-primary uppercase">
          {tKinds(`${planKind}.title`)}
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight break-words">
          {editor.planTitle}
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {t("editorDescription", { name: editor.clientName })}
        </p>
      </header>
      <PlanEditor
        clientId={id.data}
        clientName={editor.clientName}
        kind={planKind}
        schedule={editor.schedule}
        pending={editor.pending}
      />
    </div>
  );
}

/** Sur son compte : ce qu'une page propose de changer, avant d'accepter ou non. */
export async function ProposalReview({ proposalId }: { proposalId: string }) {
  const id = recordIdSchema.safeParse(proposalId);
  if (!id.success) notFound();
  const profile = await getCurrentProfile();
  const proposal = await getProposal(profile.id, id.data);
  if (!proposal) notFound();
  const [t, tKinds, format] = await Promise.all([
    getTranslations("Clients.proposals"),
    getTranslations("Development.kinds"),
    getFormatter(),
  ]);
  const plan = tKinds(`${proposal.kind}.title`);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={`/pages/${proposal.page.handle}`}
          className="flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PageLogo
            name={proposal.page.name}
            url={proposal.page.logoUrl}
            className="size-11 text-lg"
          />
          <span className="font-semibold">{proposal.page.name}</span>
        </Link>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-balance">
          {t("reviewTitle", { plan })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {proposal.planTitle} ·{" "}
          {t("sentOn", { date: date(proposal.createdAt) })}
        </p>
        {proposal.note ? (
          <p className="text-sm break-words whitespace-pre-line">
            {t("noteFrom", { page: proposal.page.name, note: proposal.note })}
          </p>
        ) : null}
      </header>

      {proposal.status !== "pending" ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-foreground/[0.05] p-4 text-sm"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t(`decided.${proposal.status}`, {
            date: date(proposal.decidedAt ?? proposal.createdAt),
          })}
        </p>
      ) : proposal.outdated ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-foreground/[0.05] p-4 text-sm text-pretty"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("outdatedNotice", { page: proposal.page.name })}
        </p>
      ) : null}

      <section
        aria-labelledby="proposal-changes"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <h2 id="proposal-changes" className="caps-label text-muted-foreground">
          {t("changesTitle")}
        </h2>
        {proposal.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noChanges")}</p>
        ) : (
          <ol className="flex flex-col">
            {proposal.changes.map((change) => (
              <ChangeRow key={change.weekday} change={change} />
            ))}
          </ol>
        )}
      </section>

      {proposal.status === "pending" ? (
        <section className="flex flex-col gap-3 border-t border-foreground/8 pt-6">
          <p className="text-sm text-pretty text-muted-foreground">
            {t("answerHint", { page: proposal.page.name })}
          </p>
          <ProposalAnswerButtons
            proposalId={proposal.id}
            canAccept={!proposal.outdated}
          />
        </section>
      ) : null}
    </div>
  );
}

/** Un jour qui change : séance ajoutée ou retirée, titre, éléments. */
async function ChangeRow({ change }: { change: DayChange }) {
  const [t, format] = await Promise.all([
    getTranslations("Clients.proposals"),
    getFormatter(),
  ]);
  // 1er janvier 2024 : un lundi
  const day = format.dateTime(new Date(Date.UTC(2024, 0, change.weekday)), {
    weekday: "long",
    timeZone: "UTC",
  });
  return (
    <li className="flex flex-col gap-2 border-b border-foreground/8 py-4">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold capitalize">{day}</span>
        <span className="text-xs font-medium text-muted-foreground">
          {t(`day.${change.status}`)}
        </span>
      </p>
      {change.titleBefore &&
      change.titleAfter &&
      change.titleBefore !== change.titleAfter ? (
        <p className="text-sm">
          <span className="text-muted-foreground line-through">
            {change.titleBefore}
          </span>{" "}
          → <span className="font-medium">{change.titleAfter}</span>
        </p>
      ) : (
        <p className="text-sm font-medium">
          {change.titleAfter ?? change.titleBefore}
        </p>
      )}
      <ul className="flex flex-col gap-1 text-sm">
        {change.added.map((item, index) => (
          <li key={`a${index}`} className="flex items-start gap-2">
            <Plus
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            <span className="min-w-0 break-words">
              <span className="sr-only">{t("added")} </span>
              {item.name}
              {item.detail ? (
                <span className="text-muted-foreground"> · {item.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
        {change.removed.map((item, index) => (
          <li
            key={`r${index}`}
            className="flex items-start gap-2 text-muted-foreground"
          >
            <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words line-through">
              <span className="sr-only">{t("removed")} </span>
              {item.name}
            </span>
          </li>
        ))}
        {change.changed.map(({ before, after }, index) => (
          <li key={`c${index}`} className="flex flex-col pl-6">
            <span className="font-medium break-words">{after.name}</span>
            <span className="text-xs break-words">
              <span className="text-muted-foreground line-through">
                {before.detail || t("noDetail")}
              </span>{" "}
              → {after.detail || t("noDetail")}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
