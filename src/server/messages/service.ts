import "server-only";
import {
  progressDataSchema,
  type ProgressData,
} from "@/features/community/rules";
import {
  DAILY_MESSAGE_LIMIT,
  DAILY_NEW_CONVERSATION_LIMIT,
  directKey,
  INBOX_SIZE,
  MESSAGE_PAGE_SIZE,
  sendPermission,
  type MemberStatus,
  type MessageError,
  type Reaction,
} from "@/features/messages/rules";
import { Prisma } from "@/generated/prisma/client";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { freezeProgress, type ProgressSource } from "@/server/community/posts";
import { db } from "@/server/db";
import { getLevels } from "@/server/xp/service";

// Messagerie privée entre membres du Centre. Chaque fonction reçoit l'userId
// de la session et vérifie qu'il participe à la conversation, sans blocage.
// Les messages ne sont jamais envoyés à Get iT AI.

const DAY_MS = 24 * 60 * 60 * 1000;
const since24h = () => new Date(Date.now() - DAY_MS);

type Fail = { ok: false; error: MessageError };

export type MessagePerson = {
  id: string;
  displayName: string | null;
  username: string | null;
  level: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  mine: boolean;
  kind: "text" | "progress";
  body: string;
  progress: ProgressData | null;
  deleted: boolean;
  createdAt: string;
  /** Au plus une réaction par personne. */
  reactions: { kind: Reaction; mine: boolean }[];
};

export type InboxItem = {
  id: string;
  other: MessagePerson;
  /** « request » : demande reçue, pas encore acceptée. */
  status: MemberStatus;
  unread: boolean;
  lastMessage: {
    mine: boolean;
    kind: "text" | "progress";
    body: string;
    deleted: boolean;
  };
  lastMessageAt: string;
};

export type ConversationState = {
  id: string;
  other: MessagePerson;
  viewerStatus: MemberStatus;
  otherStatus: MemberStatus;
  permission: ReturnType<typeof sendPermission>;
  /** Peut écrire dans le Centre (membre, pas suspendu). */
  canWrite: boolean;
  messages: ChatMessage[];
  hasMore: boolean;
  /** Moment du chargement : base de « Aujourd'hui » et « Hier ». */
  loadedAt: number;
};

export type MessageCursor = { createdAt: string; id: string };

const messageSelect = {
  id: true,
  senderId: true,
  kind: true,
  body: true,
  progress: true,
  deletedAt: true,
  createdAt: true,
  reactions: { select: { userId: true, kind: true } },
} as const;

type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

function toChatMessage(viewerId: string, row: MessageRow): ChatMessage {
  const progress = row.progress
    ? progressDataSchema.safeParse(row.progress)
    : null;
  return {
    id: row.id,
    senderId: row.senderId,
    mine: row.senderId === viewerId,
    kind: row.kind,
    body: row.deletedAt ? "" : row.body,
    progress: !row.deletedAt && progress?.success ? progress.data : null,
    deleted: row.deletedAt !== null,
    createdAt: row.createdAt.toISOString(),
    reactions: row.reactions.map((reaction) => ({
      kind: reaction.kind,
      mine: reaction.userId === viewerId,
    })),
  };
}

/** Peut écrire : membre du Centre et pas suspendu. */
async function canWrite(userId: string): Promise<{ ok: true } | Fail> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  return { ok: true };
}

async function isBlockedPair(a: string, b: string) {
  const blocks = await db.userBlock.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return blocks > 0;
}

/** La conversation, vue par un participant ; null s'il n'y est pas ou s'il y a un blocage. */
async function loadMembership(viewerId: string, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, members: { some: { userId: viewerId } } },
    select: {
      id: true,
      members: {
        select: {
          userId: true,
          status: true,
          lastReadAt: true,
          clearedAt: true,
        },
      },
    },
  });
  const viewer = conversation?.members.find((m) => m.userId === viewerId);
  const other = conversation?.members.find((m) => m.userId !== viewerId);
  if (!conversation || !viewer || !other) return null;
  if (await isBlockedPair(viewerId, other.userId)) return null;
  return { id: conversation.id, viewer, other };
}

async function people(ids: string[]): Promise<Map<string, MessagePerson>> {
  const [profiles, levels] = await Promise.all([
    db.profile.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, username: true },
    }),
    getLevels(ids),
  ]);
  return new Map(
    profiles.map((profile) => [
      profile.id,
      { ...profile, level: levels.get(profile.id) ?? 1 },
    ]),
  );
}

/** Membres du Centre à qui écrire, par @nom ou par prénom. */
export async function searchMembers(
  viewerId: string,
  query: string,
): Promise<MessagePerson[]> {
  const blocked = await getBlockedIds(viewerId);
  const handle = query.replace(/^@/, "").toLowerCase();
  const found = await db.profile.findMany({
    where: {
      id: { notIn: [viewerId, ...blocked] },
      username: { not: null },
      settings: { communityRulesAt: { not: null } },
      OR: [
        { username: { startsWith: handle } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { username: "asc" },
    take: 10,
    select: { id: true },
  });
  const byId = await people(found.map((person) => person.id));
  return found.flatMap((person) => byId.get(person.id) ?? []);
}

/**
 * Ouvre la conversation avec quelqu'un (la crée au besoin). Pour une nouvelle
 * conversation, l'autre personne la reçoit comme une demande.
 */
export async function startConversation(
  viewerId: string,
  otherId: string,
): Promise<{ ok: true; id: string } | Fail> {
  if (viewerId === otherId) return { ok: false, error: "notFound" };
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const other = await getCommunityMember(otherId);
  if (!other?.joined) return { ok: false, error: "notFound" };
  if (await isBlockedPair(viewerId, otherId)) {
    return { ok: false, error: "blocked" };
  }

  const key = directKey(viewerId, otherId);
  const existing = await db.conversation.findUnique({
    where: { directKey: key },
    select: { id: true },
  });
  if (existing) return { ok: true, id: existing.id };

  const started = await db.conversation.count({
    where: { createdById: viewerId, createdAt: { gte: since24h() } },
  });
  if (started >= DAILY_NEW_CONVERSATION_LIMIT) {
    return { ok: false, error: "conversationLimit" };
  }
  try {
    const created = await db.conversation.create({
      data: {
        directKey: key,
        createdById: viewerId,
        members: {
          create: [
            { userId: viewerId, status: "accepted" },
            { userId: otherId, status: "request" },
          ],
        },
      },
      select: { id: true },
    });
    return { ok: true, id: created.id };
  } catch (error) {
    // Les deux personnes ont commencé en même temps : on reprend l'existante
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await db.conversation.findUnique({
        where: { directKey: key },
        select: { id: true },
      });
      if (again) return { ok: true, id: again.id };
    }
    throw error;
  }
}

/** Conversations visibles (avec au moins un message après une éventuelle suppression). */
async function inboxRows(viewerId: string) {
  const blocked = await getBlockedIds(viewerId);
  const rows = await db.conversationMember.findMany({
    where: {
      userId: viewerId,
      conversation: {
        messages: { some: {} },
        members: { none: { userId: { in: blocked } } },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: INBOX_SIZE,
    select: {
      status: true,
      lastReadAt: true,
      clearedAt: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          members: {
            where: { userId: { not: viewerId } },
            select: { userId: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              senderId: true,
              kind: true,
              body: true,
              deletedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const last = row.conversation.messages[0];
    const otherId = row.conversation.members[0]?.userId;
    if (!last || !otherId) return [];
    if (row.clearedAt && last.createdAt <= row.clearedAt) return [];
    const unread =
      last.senderId !== viewerId &&
      (!row.lastReadAt || last.createdAt > row.lastReadAt);
    return [{ row, last, otherId, unread }];
  });
}

/** Boîte de réception : discussions et demandes reçues, les plus récentes d'abord. */
export async function listInbox(
  viewerId: string,
): Promise<{ items: InboxItem[]; loadedAt: number }> {
  const rows = await inboxRows(viewerId);
  const byId = await people([...new Set(rows.map((item) => item.otherId))]);
  const items = rows.flatMap(({ row, last, otherId, unread }) => {
    const other = byId.get(otherId);
    if (!other) return [];
    return {
      id: row.conversation.id,
      other,
      status: row.status,
      unread,
      lastMessage: {
        mine: last.senderId === viewerId,
        kind: last.kind,
        body: last.deletedAt ? "" : last.body,
        deleted: last.deletedAt !== null,
      },
      lastMessageAt: row.conversation.lastMessageAt.toISOString(),
    };
  });
  return { items, loadedAt: Date.now() };
}

/** Conversations avec des messages non lus (pastille de l'onglet Messagerie). */
export async function countUnread(viewerId: string) {
  const rows = await inboxRows(viewerId);
  return rows.filter((item) => item.unread).length;
}

async function messagesPage(
  viewerId: string,
  conversationId: string,
  clearedAt: Date | null,
  before?: MessageCursor,
) {
  const rows = await db.message.findMany({
    where: {
      conversationId,
      AND: [
        clearedAt ? { createdAt: { gt: clearedAt } } : {},
        before
          ? {
              OR: [
                { createdAt: { lt: new Date(before.createdAt) } },
                {
                  createdAt: new Date(before.createdAt),
                  id: { lt: before.id },
                },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MESSAGE_PAGE_SIZE + 1,
    select: messageSelect,
  });
  return {
    // Du plus ancien au plus récent, pour l'affichage
    messages: rows
      .slice(0, MESSAGE_PAGE_SIZE)
      .reverse()
      .map((row) => toChatMessage(viewerId, row)),
    hasMore: rows.length > MESSAGE_PAGE_SIZE,
  };
}

/** Une conversation et ses derniers messages ; null si elle n'est pas accessible. */
export async function getConversation(
  viewerId: string,
  conversationId: string,
): Promise<ConversationState | null> {
  const membership = await loadMembership(viewerId, conversationId);
  if (!membership) return null;
  const [byId, viewerMessages, page, allowed] = await Promise.all([
    people([membership.other.userId]),
    db.message.count({ where: { conversationId, senderId: viewerId } }),
    messagesPage(viewerId, conversationId, membership.viewer.clearedAt),
    canWrite(viewerId),
  ]);
  const other = byId.get(membership.other.userId);
  if (!other) return null;
  return {
    id: membership.id,
    other,
    viewerStatus: membership.viewer.status,
    otherStatus: membership.other.status,
    permission: sendPermission({
      viewerStatus: membership.viewer.status,
      otherStatus: membership.other.status,
      viewerMessages,
    }),
    canWrite: allowed.ok,
    messages: page.messages,
    hasMore: page.hasMore,
    loadedAt: Date.now(),
  };
}

/** Messages plus anciens (« Messages précédents »). */
export async function listOlderMessages(
  viewerId: string,
  conversationId: string,
  before: MessageCursor,
) {
  const membership = await loadMembership(viewerId, conversationId);
  if (!membership) return null;
  return messagesPage(
    viewerId,
    conversationId,
    membership.viewer.clearedAt,
    before,
  );
}

export type MessageInput =
  | { kind: "text"; body: string }
  | { kind: "progress"; source: ProgressSource; body: string };

/** Envoie un message (texte, ou progrès réel revérifié et figé par le serveur). */
export async function sendMessage(
  viewerId: string,
  conversationId: string,
  input: MessageInput,
): Promise<{ ok: true; message: ChatMessage } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const membership = await loadMembership(viewerId, conversationId);
  if (!membership) return { ok: false, error: "notFound" };

  const [viewerMessages, recent] = await Promise.all([
    db.message.count({ where: { conversationId, senderId: viewerId } }),
    db.message.count({
      where: { senderId: viewerId, createdAt: { gte: since24h() } },
    }),
  ]);
  const permission = sendPermission({
    viewerStatus: membership.viewer.status,
    otherStatus: membership.other.status,
    viewerMessages,
  });
  if (permission !== "ok") return { ok: false, error: permission };
  if (recent >= DAILY_MESSAGE_LIMIT) {
    return { ok: false, error: "messageLimit" };
  }

  let progress: ProgressData | null = null;
  if (input.kind === "progress") {
    progress = await freezeProgress(viewerId, input.source);
    if (!progress) return { ok: false, error: "notFound" };
  }

  const now = new Date();
  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId,
        senderId: viewerId,
        kind: input.kind,
        body: input.body,
        progress: progress ?? Prisma.DbNull,
        createdAt: now,
      },
      select: messageSelect,
    }),
    db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    }),
    db.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: viewerId } },
      data: { lastReadAt: now },
    }),
  ]);
  return { ok: true, message: toChatMessage(viewerId, message) };
}

/** La conversation est lue jusqu'ici (seulement pour la pastille : pas de « Vu »). */
export async function markRead(viewerId: string, conversationId: string) {
  await db.conversationMember.updateMany({
    where: { conversationId, userId: viewerId },
    data: { lastReadAt: new Date() },
  });
}

/**
 * Répond à une demande reçue. Refuser la retire des Demandes, sans prévenir
 * l'expéditeur, qui ne peut toujours pas écrire de nouveau.
 */
export async function respondToRequest(
  viewerId: string,
  conversationId: string,
  accept: boolean,
) {
  const membership = await loadMembership(viewerId, conversationId);
  if (!membership || membership.viewer.status !== "request") return false;
  const now = new Date();
  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: viewerId } },
    data: accept
      ? { status: "accepted", lastReadAt: now }
      : { clearedAt: now, lastReadAt: now },
  });
  return true;
}

/** Supprime son propre message pour tout le monde (le contenu est effacé). */
export async function deleteMessage(viewerId: string, messageId: string) {
  const { count } = await db.message.updateMany({
    where: { id: messageId, senderId: viewerId, deletedAt: null },
    data: { deletedAt: new Date(), body: "", progress: Prisma.DbNull },
  });
  if (count > 0) await db.messageReaction.deleteMany({ where: { messageId } });
  return count > 0;
}

/** Réagit au message de l'autre personne (null : retire sa réaction). */
export async function setMessageReaction(
  viewerId: string,
  messageId: string,
  kind: Reaction | null,
) {
  const message = await db.message.findFirst({
    where: {
      id: messageId,
      deletedAt: null,
      conversation: { members: { some: { userId: viewerId } } },
    },
    select: { senderId: true },
  });
  if (!message || message.senderId === viewerId) return false;
  if (await isBlockedPair(viewerId, message.senderId)) return false;
  if (kind === null) {
    await db.messageReaction.deleteMany({
      where: { messageId, userId: viewerId },
    });
  } else {
    await db.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId: viewerId } },
      update: { kind },
      create: { messageId, userId: viewerId, kind },
    });
  }
  return true;
}

/** Supprime la conversation de son côté : elle réapparaît au prochain message. */
export async function clearConversation(
  viewerId: string,
  conversationId: string,
) {
  const now = new Date();
  const { count } = await db.conversationMember.updateMany({
    where: { conversationId, userId: viewerId },
    data: { clearedAt: now, lastReadAt: now },
  });
  return count > 0;
}
