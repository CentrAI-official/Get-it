import "server-only";
import { canSeePlan, type ShareableKind } from "@/features/clients/rules";
import {
  buildProposedSchedule,
  PROPOSAL_LIMITS,
  sameSchedule,
  scheduleDiff,
  type DayChange,
  type ProposalError,
  type ProposalStatus,
  type Schedule,
  type ScheduleEdit,
} from "@/features/clients/proposals";
import {
  storedPlanSchema,
  type DevelopmentPlan,
} from "@/features/development/plan";
import { getCommunityMember } from "@/server/community/members";
import { db } from "@/server/db";
import { notify } from "@/server/notifications/service";
import { avatarUrls } from "@/server/profile/avatar";

// Modifications de plan proposées par une page pro (lot 4). Rien ne change
// dans le plan du client avant qu'il accepte ; la page doit toujours avoir le
// droit de voir ce plan (suivi en cours, plan partagé) au moment d'agir.

type Result<T = object> =
  ({ ok: true } & T) | { ok: false; error: ProposalError };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Le suivi en cours de la page avec ce client, s'il lui montre ce plan. */
async function canSee(pageId: string, clientId: string, kind: ShareableKind) {
  const relation = await db.pageClient.findFirst({
    where: { pageId, clientId, status: "active" },
    select: { status: true, sharedKinds: true, mentalConsentAt: true },
  });
  return relation ? canSeePlan(relation, kind) : false;
}

/** Le plan enregistré, avec une semaine relue (null s'il est illisible). */
function readPlan(raw: unknown): DevelopmentPlan | null {
  const parsed = storedPlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Une semaine enregistrée dans une proposition, relue avec le reste du plan. */
function readSchedule(plan: DevelopmentPlan, raw: unknown): Schedule | null {
  const parsed = storedPlanSchema.safeParse({ ...plan, schedule: raw });
  return parsed.success ? parsed.data.schedule : null;
}

/**
 * Retire les propositions en attente qui ne peuvent plus s'appliquer : fin du
 * suivi, ou plan que le client ne partage plus (`keep` : les plans encore
 * partagés).
 */
export async function withdrawPendingProposals(
  pageId: string,
  clientId: string,
  keep: readonly ShareableKind[] = [],
) {
  await db.planProposal.updateMany({
    where: {
      pageId,
      clientId,
      status: "pending",
      ...(keep.length > 0 ? { kind: { notIn: [...keep] } } : {}),
    },
    data: { status: "withdrawn", decidedAt: new Date() },
  });
}

// ——— Côté page ———

export type ProposalSummary = {
  id: string;
  kind: ShareableKind;
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
};

/** L'historique des propositions de la page à ce client (plus récentes d'abord). */
export async function listProposalHistory(
  pageId: string,
  clientId: string,
): Promise<ProposalSummary[]> {
  const rows = await db.planProposal.findMany({
    where: { pageId, clientId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
      decidedAt: true,
    },
  });
  return rows.flatMap((row) =>
    row.kind === "business"
      ? []
      : [
          {
            id: row.id,
            kind: row.kind,
            status: row.status,
            createdAt: row.createdAt.toISOString(),
            decidedAt: row.decidedAt?.toISOString() ?? null,
          },
        ],
  );
}

export type PlanEditor = {
  clientName: string;
  planTitle: string;
  /** La semaine à modifier : celle déjà proposée si une attend sa réponse. */
  schedule: Schedule;
  pending: { id: string; note: string; createdAt: string } | null;
};

/** Ce qu'il faut pour modifier le plan d'un client (mode page), ou null. */
export async function getPlanEditor(
  ownerId: string,
  pageId: string,
  clientId: string,
  kind: ShareableKind,
): Promise<PlanEditor | null> {
  const page = await db.page.count({ where: { id: pageId, ownerId } });
  if (page === 0 || !(await canSee(pageId, clientId, kind))) return null;
  const [row, client] = await Promise.all([
    db.developmentPlan.findUnique({
      where: { userId_kind: { userId: clientId, kind } },
      select: { id: true, plan: true },
    }),
    db.profile.findUnique({
      where: { id: clientId },
      select: { displayName: true, username: true },
    }),
  ]);
  const plan = row ? readPlan(row.plan) : null;
  if (!row || !plan || !client) return null;
  const pending = await db.planProposal.findFirst({
    where: { pageId, planId: row.id, status: "pending" },
    select: { id: true, note: true, after: true, createdAt: true },
  });
  const proposed = pending ? readSchedule(plan, pending.after) : null;
  return {
    clientName: client.displayName ?? client.username ?? "",
    planTitle: plan.title,
    schedule: proposed ?? plan.schedule,
    pending: pending
      ? {
          id: pending.id,
          note: pending.note,
          createdAt: pending.createdAt.toISOString(),
        }
      : null,
  };
}

/**
 * Propose une modification de la semaine type. Une proposition déjà en
 * attente pour ce plan est remplacée ; le client est prévenu.
 */
export async function proposePlanChange(
  ownerId: string,
  pageId: string,
  clientId: string,
  kind: ShareableKind,
  edit: ScheduleEdit,
  note: string,
): Promise<Result<{ id: string }>> {
  const [member, page] = await Promise.all([
    getCommunityMember(ownerId),
    db.page.count({ where: { id: pageId, ownerId } }),
  ]);
  if (!member?.joined || member.suspendedUntil || page === 0) {
    return { ok: false, error: "notFound" };
  }
  if (!(await canSee(pageId, clientId, kind))) {
    return { ok: false, error: "notFound" };
  }
  const row = await db.developmentPlan.findUnique({
    where: { userId_kind: { userId: clientId, kind } },
    select: { id: true, plan: true },
  });
  const plan = row ? readPlan(row.plan) : null;
  if (!row || !plan) return { ok: false, error: "notFound" };
  const after = buildProposedSchedule(plan.schedule, edit);
  if (sameSchedule(plan.schedule, after)) {
    return { ok: false, error: "noChange" };
  }
  const recent = await db.planProposal.count({
    where: { pageId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  });
  if (recent >= PROPOSAL_LIMITS.perDay) {
    return { ok: false, error: "proposalLimit" };
  }
  const created = await db.$transaction(async (tx) => {
    // La nouvelle remplace celle qui attendait encore
    await tx.planProposal.updateMany({
      where: { pageId, planId: row.id, status: "pending" },
      data: { status: "withdrawn", decidedAt: new Date() },
    });
    return tx.planProposal.create({
      data: {
        pageId,
        clientId,
        planId: row.id,
        kind,
        before: plan.schedule,
        after,
        note,
      },
      select: { id: true },
    });
  });
  await notify({
    userId: clientId,
    kind: "plan_change",
    actorId: ownerId,
    actorPageId: pageId,
    subject: plan.title,
    href: `/profile/pros/changes/${created.id}`,
    groupKey: `plan-change:${pageId}:${kind}`,
  });
  return { ok: true, id: created.id };
}

/** La page retire sa proposition (tant qu'elle attend). */
export async function withdrawProposal(
  ownerId: string,
  pageId: string,
  proposalId: string,
) {
  const { count } = await db.planProposal.updateMany({
    where: {
      id: proposalId,
      pageId,
      page: { ownerId },
      status: "pending",
    },
    data: { status: "withdrawn", decidedAt: new Date() },
  });
  return count > 0;
}

// ——— Côté client ———

export type ClientProposal = {
  id: string;
  kind: ShareableKind;
  status: ProposalStatus;
  planTitle: string;
  note: string;
  createdAt: string;
  decidedAt: string | null;
  page: { name: string; handle: string; logoUrl: string | null };
  /** Ce qui change par rapport à mon plan actuel. */
  changes: DayChange[];
  /** Mon plan a changé depuis : elle ne peut plus s'appliquer. */
  outdated: boolean;
};

/** Une proposition reçue, avec ce qu'elle change jour par jour ; null si elle n'est pas à moi. */
export async function getProposal(
  userId: string,
  proposalId: string,
): Promise<ClientProposal | null> {
  const row = await db.planProposal.findFirst({
    where: { id: proposalId, clientId: userId },
    select: {
      id: true,
      pageId: true,
      kind: true,
      status: true,
      note: true,
      before: true,
      after: true,
      createdAt: true,
      decidedAt: true,
      plan: { select: { plan: true } },
      page: { select: { name: true, handle: true, logoPath: true } },
    },
  });
  if (!row || row.kind === "business") return null;
  const plan = readPlan(row.plan.plan);
  if (!plan) return null;
  let status = row.status;
  // Le suivi a pris fin, ou le plan n'est plus partagé : elle est retirée
  if (status === "pending" && !(await canSee(row.pageId, userId, row.kind))) {
    await withdrawPendingProposals(row.pageId, userId);
    status = "withdrawn";
  }
  const before = readSchedule(plan, row.before) ?? [];
  const after = readSchedule(plan, row.after) ?? [];
  const urls = await avatarUrls([row.page.logoPath]);
  return {
    id: row.id,
    kind: row.kind,
    status,
    planTitle: plan.title,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    page: {
      name: row.page.name,
      handle: row.page.handle,
      logoUrl: row.page.logoPath ? (urls.get(row.page.logoPath) ?? null) : null,
    },
    // En attente : par rapport au plan d'aujourd'hui ; décidée : telle que proposée
    changes: scheduleDiff(status === "pending" ? plan.schedule : before, after),
    outdated: status === "pending" && !sameSchedule(plan.schedule, before),
  };
}

/**
 * J'accepte (le plan est modifié, s'il n'a pas changé depuis la proposition)
 * ou je refuse. La page est prévenue dans les deux cas.
 */
export async function answerProposal(
  userId: string,
  proposalId: string,
  accept: boolean,
): Promise<Result<{ status: ProposalStatus }>> {
  const row = await db.planProposal.findFirst({
    where: { id: proposalId, clientId: userId, status: "pending" },
    select: {
      id: true,
      pageId: true,
      planId: true,
      kind: true,
      before: true,
      after: true,
      page: { select: { ownerId: true } },
    },
  });
  if (!row || row.kind === "business") return { ok: false, error: "notFound" };
  if (!(await canSee(row.pageId, userId, row.kind))) {
    await withdrawPendingProposals(row.pageId, userId);
    return { ok: false, error: "notFound" };
  }
  const result = await db.$transaction(async (tx) => {
    const stored = await tx.developmentPlan.findFirst({
      where: { id: row.planId, userId },
      select: { plan: true },
    });
    const plan = stored ? readPlan(stored.plan) : null;
    if (!plan) return "notFound" as const;
    const now = new Date();
    if (!accept) {
      await tx.planProposal.update({
        where: { id: row.id },
        data: { status: "declined", decidedAt: now },
      });
      return { status: "declined" as const, title: plan.title };
    }
    const before = readSchedule(plan, row.before);
    const after = readSchedule(plan, row.after);
    if (!before || !after || !sameSchedule(plan.schedule, before)) {
      await tx.planProposal.update({
        where: { id: row.id },
        data: { status: "outdated", decidedAt: now },
      });
      return "outdated" as const;
    }
    await tx.developmentPlan.update({
      where: { id: row.planId },
      data: { plan: { ...plan, schedule: after } },
    });
    await tx.planProposal.update({
      where: { id: row.id },
      data: { status: "accepted", decidedAt: now },
    });
    return { status: "accepted" as const, title: plan.title };
  });
  if (result === "notFound" || result === "outdated") {
    return { ok: false, error: result };
  }
  // La cloche de la page
  await notify({
    userId: row.page.ownerId,
    pageId: row.pageId,
    kind:
      result.status === "accepted"
        ? "plan_change_accepted"
        : "plan_change_declined",
    actorId: userId,
    subject: result.title,
    href: `/clients/${userId}`,
    groupKey: `plan-answer:${row.id}`,
  });
  return { ok: true, status: result.status };
}

export type MyProposalItem = {
  id: string;
  pageId: string;
  kind: ShareableKind;
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
};

/** Mes propositions reçues (Mes pros) : en attente, puis l'historique récent. */
export async function listMyProposals(
  userId: string,
): Promise<MyProposalItem[]> {
  const rows = await db.planProposal.findMany({
    where: { clientId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      pageId: true,
      kind: true,
      status: true,
      createdAt: true,
      decidedAt: true,
    },
  });
  return rows.flatMap((row) =>
    row.kind === "business"
      ? []
      : [
          {
            id: row.id,
            pageId: row.pageId,
            kind: row.kind,
            status: row.status,
            createdAt: row.createdAt.toISOString(),
            decidedAt: row.decidedAt?.toISOString() ?? null,
          },
        ],
  );
}
