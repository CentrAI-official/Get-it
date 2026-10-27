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
import { sharedPostsFor, type SharedPost } from "@/server/community/feed";
import type { PostMediaInput, UploadRequest } from "@/features/community/media";
import {
  requestUploads,
  verifyMedia,
  type FeedMedia,
  type UploadSlot,
} from "@/server/community/media";
import {
  messageMediaError,
  messageMediaFor,
  removeMessageMedia,
} from "./media";
import {
  freezeProgress,
  reachablePost,
  type ProgressSource,
} from "@/server/community/posts";
import { db } from "@/server/db";
import type { ContactState } from "@/features/contacts/rules";
import { topicOf, type GroupTopic } from "@/features/groups/rules";
import {
  areContacts,
  contactIds,
  getContactState,
} from "@/server/contacts/service";
import { avatarUrls } from "@/server/profile/avatar";
import { getDisplayLevels } from "@/server/ranked/service";
import {
  getOpenPact,
  pactCardsFor,
  settlePacts,
  type PactBanner,
  type PactCard,
} from "./pacts";

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
  /** Photo de profil (lien temporaire), ou null : l'initiale est montrée. */
  avatarUrl: string | null;
  /** Niveau classé (mode Ranked), ou null : sans Ranked, le niveau reste privé. */
  level: number | null;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  mine: boolean;
  kind: "text" | "progress" | "pact" | "post";
  /** Texte ; pour un pacte, l'étape (« proposed », « ended », « cancelled »). */
  body: string;
  progress: ProgressData | null;
  /**
   * Publication envoyée (message « post »), telle que la personne qui lit peut
   * la voir, ou « unavailable » (supprimée, retirée, auteur bloqué).
   */
  post: SharedPost | "unavailable" | null;
  /** Photos ou vidéo jointes (liens de lecture temporaires). */
  media: FeedMedia[];
  /** Le pacte d'un message « pact », dans son état actuel. */
  pact: PactCard | null;
  deleted: boolean;
  createdAt: string;
  /** Au plus une réaction par personne. */
  reactions: { kind: Reaction; mine: boolean }[];
};

export type InboxItem = {
  id: string;
  /** Conversation à deux : l'autre personne ; discussion de groupe : l'auteur du dernier message. */
  other: MessagePerson;
  /** Discussion d'un groupe privé. */
  group: { id: string; name: string; topic: GroupTopic } | null;
  /** « request » : demande reçue, pas encore acceptée. */
  status: MemberStatus;
  unread: boolean;
  lastMessage: {
    mine: boolean;
    kind: "text" | "progress" | "pact" | "post";
    body: string;
    deleted: boolean;
    /** Première photo ou vidéo jointe, pour l'aperçu sans texte. */
    media: "image" | "video" | null;
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
  /** Relation de contact avec l'autre personne. */
  contact: ContactState;
  /** Pacte proposé ou en cours dans la conversation. */
  pact: PactBanner | null;
  /** Pactes déjà proposés ici (la suggestion « Faites-le ensemble » n'apparaît qu'au début). */
  pactCount: number;
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
  pactId: true,
  postId: true,
  mediaCount: true,
  deletedAt: true,
  createdAt: true,
  reactions: { select: { userId: true, kind: true } },
} as const;

type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

function toChatMessage(
  viewerId: string,
  row: MessageRow,
  pacts: Map<string, PactCard> = new Map(),
  posts: Map<string, SharedPost> = new Map(),
  media: Map<string, FeedMedia[]> = new Map(),
): ChatMessage {
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
    pact: row.pactId ? (pacts.get(row.pactId) ?? null) : null,
    post:
      row.kind === "post" && !row.deletedAt
        ? ((row.postId ? posts.get(row.postId) : undefined) ?? "unavailable")
        : null,
    media: row.deletedAt ? [] : (media.get(row.id) ?? []),
    deleted: row.deletedAt !== null,
    createdAt: row.createdAt.toISOString(),
    reactions: row.reactions.map((reaction) => ({
      kind: reaction.kind,
      mine: reaction.userId === viewerId,
    })),
  };
}

/** Peut écrire : membre du Centre et pas suspendu. */
export async function canWrite(userId: string): Promise<{ ok: true } | Fail> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  return { ok: true };
}

export async function isBlockedPair(a: string, b: string) {
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
export async function loadMembership(viewerId: string, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    // Conversation à deux seulement (les discussions de groupe : getGroupChat)
    where: {
      id: conversationId,
      groupId: null,
      members: { some: { userId: viewerId } },
    },
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
      select: { id: true, displayName: true, username: true, avatarPath: true },
    }),
    getDisplayLevels(ids),
  ]);
  const avatars = await avatarUrls(
    profiles.map((profile) => profile.avatarPath),
  );
  return new Map(
    profiles.map(({ avatarPath, ...profile }) => [
      profile.id,
      {
        ...profile,
        avatarUrl: avatarPath ? (avatars.get(avatarPath) ?? null) : null,
        level: levels.get(profile.id) ?? null,
      },
    ]),
  );
}

/** Membres du Centre à qui écrire, par @nom ou par prénom. */
export async function searchMembers(
  viewerId: string,
  query: string,
): Promise<(MessagePerson & { contact: boolean })[]> {
  const [blocked, contacts] = await Promise.all([
    getBlockedIds(viewerId),
    contactIds(viewerId),
  ]);
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
    take: 20,
    select: { id: true },
  });
  const byId = await people(found.map((person) => person.id));
  return found
    .flatMap((person) => {
      const found = byId.get(person.id);
      return found ? [{ ...found, contact: contacts.has(person.id) }] : [];
    })
    .sort((a, b) => Number(b.contact) - Number(a.contact))
    .slice(0, 10);
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

  const contact = await areContacts(viewerId, otherId);
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
            { userId: otherId, status: contact ? "accepted" : "request" },
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
        // À deux : jamais avec une personne bloquée ; un groupe reste visible
        OR: [
          { groupId: { not: null } },
          { members: { none: { userId: { in: blocked } } } },
        ],
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
          group: { select: { id: true, name: true, pillar: true } },
          members: {
            where: { userId: { not: viewerId } },
            take: 1,
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
              media: {
                take: 1,
                orderBy: { position: "asc" },
                select: { kind: true },
              },
            },
          },
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const last = row.conversation.messages[0];
    // Groupe : la personne du dernier message (aperçu « Bruno : … »)
    const otherId = row.conversation.group
      ? last?.senderId === viewerId
        ? (row.conversation.members[0]?.userId ?? viewerId)
        : last?.senderId
      : row.conversation.members[0]?.userId;
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
    const group = row.conversation.group;
    return {
      id: row.conversation.id,
      other,
      group: group
        ? { id: group.id, name: group.name, topic: topicOf(group.pillar) }
        : null,
      status: row.status,
      unread,
      lastMessage: {
        mine: last.senderId === viewerId,
        kind: last.kind,
        body: last.deletedAt ? "" : last.body,
        deleted: last.deletedAt !== null,
        media: last.deletedAt ? null : (last.media[0]?.kind ?? null),
      },
      lastMessageAt: row.conversation.lastMessageAt.toISOString(),
    };
  });
  return { items, loadedAt: Date.now() };
}

export type ShareTarget = {
  person: MessagePerson;
  /** Conversation existante, sinon elle est créée à l'envoi. */
  conversationId: string | null;
};

/**
 * À qui envoyer une publication : les discussions récentes (pas les demandes
 * reçues, encore à accepter), puis les contacts sans discussion.
 */
export async function listShareTargets(
  viewerId: string,
): Promise<ShareTarget[]> {
  const [rows, contacts] = await Promise.all([
    inboxRows(viewerId),
    contactIds(viewerId),
  ]);
  const order: { userId: string; conversationId: string | null }[] = [];
  const seen = new Set<string>();
  for (const { row, otherId } of rows) {
    // Les discussions de groupe ne sont pas des destinataires d'une personne
    if (row.conversation.group) continue;
    if (row.status === "request" || seen.has(otherId)) continue;
    seen.add(otherId);
    order.push({ userId: otherId, conversationId: row.conversation.id });
  }
  for (const id of contacts) {
    if (seen.has(id)) continue;
    seen.add(id);
    order.push({ userId: id, conversationId: null });
  }
  const byId = await people(order.map((item) => item.userId));
  return order.flatMap((item) => {
    const person = byId.get(item.userId);
    return person ? [{ person, conversationId: item.conversationId }] : [];
  });
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
  const page = rows.slice(0, MESSAGE_PAGE_SIZE);
  const [pacts, posts, media] = await Promise.all([
    pactCardsFor(viewerId, [
      ...new Set(page.flatMap((row) => (row.pactId ? [row.pactId] : []))),
    ]),
    sharedPostsFor(
      viewerId,
      page.flatMap((row) => (row.postId ? [row.postId] : [])),
    ),
    messageMediaFor(
      page
        .filter((row) => row.mediaCount > 0 && !row.deletedAt)
        .map((row) => row.id),
    ),
  ]);
  return {
    // Du plus ancien au plus récent, pour l'affichage
    messages: page
      .reverse()
      .map((row) => toChatMessage(viewerId, row, pacts, posts, media)),
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
  await settlePacts(conversationId, viewerId);
  const [byId, viewerMessages, page, allowed, open, contact] =
    await Promise.all([
      people([membership.other.userId]),
      db.message.count({
        where: { conversationId, senderId: viewerId, kind: { not: "pact" } },
      }),
      messagesPage(viewerId, conversationId, membership.viewer.clearedAt),
      canWrite(viewerId),
      getOpenPact(viewerId, conversationId),
      getContactState(viewerId, membership.other.userId),
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
    contact,
    pact: open.pact,
    pactCount: open.count,
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
  if (membership) {
    return messagesPage(
      viewerId,
      conversationId,
      membership.viewer.clearedAt,
      before,
    );
  }
  const member = await groupChatMember(viewerId, conversationId);
  if (!member) return null;
  const page = await messagesPage(
    viewerId,
    conversationId,
    member.clearedAt,
    before,
  );
  const blocked = await getBlockedIds(viewerId);
  return {
    ...page,
    messages: page.messages.filter((m) => !blocked.includes(m.senderId)),
  };
}

/** Membre de la discussion d'un groupe (actif dans le groupe), ou null. */
async function groupChatMember(viewerId: string, conversationId: string) {
  const member = await db.conversationMember.findFirst({
    where: {
      conversationId,
      userId: viewerId,
      conversation: { groupId: { not: null } },
    },
    select: {
      clearedAt: true,
      conversation: {
        select: {
          group: {
            select: {
              id: true,
              name: true,
              pillar: true,
              members: {
                where: { userId: viewerId, status: "active" },
                select: { userId: true },
              },
              _count: {
                select: { members: { where: { status: "active" } } },
              },
            },
          },
        },
      },
    },
  });
  const group = member?.conversation.group;
  if (!member || !group || group.members.length === 0) return null;
  return { clearedAt: member.clearedAt, group };
}

export type GroupChatState = {
  id: string;
  group: {
    id: string;
    name: string;
    topic: GroupTopic;
    memberCount: number;
  };
  /** Auteurs des messages affichés (photo, nom). */
  people: Record<string, MessagePerson>;
  /** Peut écrire dans le Centre (membre, pas suspendu). */
  canWrite: boolean;
  messages: ChatMessage[];
  hasMore: boolean;
  loadedAt: number;
};

/**
 * Discussion d'un groupe privé, pour un de ses membres ; null sinon. Les
 * messages des personnes bloquées (dans un sens ou dans l'autre) sont cachés.
 */
export async function getGroupChat(
  viewerId: string,
  conversationId: string,
): Promise<GroupChatState | null> {
  const member = await groupChatMember(viewerId, conversationId);
  if (!member) return null;
  const [page, allowed, blocked] = await Promise.all([
    messagesPage(viewerId, conversationId, member.clearedAt),
    canWrite(viewerId),
    getBlockedIds(viewerId),
  ]);
  const messages = page.messages.filter((m) => !blocked.includes(m.senderId));
  const byId = await people([...new Set(messages.map((m) => m.senderId))]);
  return {
    id: conversationId,
    group: {
      id: member.group.id,
      name: member.group.name,
      topic: topicOf(member.group.pillar),
      memberCount: member.group._count.members,
    },
    people: Object.fromEntries(byId),
    canWrite: allowed.ok,
    messages,
    hasMore: page.hasMore,
    loadedAt: Date.now(),
  };
}

/**
 * Peut écrire dans cette conversation ? Discussion de groupe : en être membre ;
 * à deux : les règles des demandes (`sendPermission`).
 */
async function sendAccess(
  viewerId: string,
  conversationId: string,
): Promise<"ok" | MessageError> {
  if (await groupChatMember(viewerId, conversationId)) return "ok";
  const membership = await loadMembership(viewerId, conversationId);
  if (!membership) return "notFound";
  const viewerMessages = await db.message.count({
    where: { conversationId, senderId: viewerId, kind: { not: "pact" } },
  });
  return sendPermission({
    viewerStatus: membership.viewer.status,
    otherStatus: membership.other.status,
    viewerMessages,
  });
}

export type MessageInput =
  | { kind: "text"; body: string; media?: PostMediaInput }
  | { kind: "progress"; source: ProgressSource; body: string }
  | { kind: "post"; postId: string; body: string };

/** Envoie un message (texte, ou progrès réel revérifié et figé par le serveur). */
export async function sendMessage(
  viewerId: string,
  conversationId: string,
  input: MessageInput,
): Promise<{ ok: true; message: ChatMessage } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const [access, recent] = await Promise.all([
    sendAccess(viewerId, conversationId),
    db.message.count({
      where: { senderId: viewerId, createdAt: { gte: since24h() } },
    }),
  ]);
  if (access !== "ok") return { ok: false, error: access };
  if (recent >= DAILY_MESSAGE_LIMIT) {
    return { ok: false, error: "messageLimit" };
  }

  let progress: ProgressData | null = null;
  if (input.kind === "progress") {
    progress = await freezeProgress(viewerId, input.source);
    if (!progress) return { ok: false, error: "notFound" };
  }
  // Photos ou vidéo : fichiers vérifiés dans le stockage avant d'écrire quoi que ce soit
  const verified = await verifyMedia(
    viewerId,
    input.kind === "text" ? (input.media ?? []) : [],
  );
  if (!verified.ok) {
    return { ok: false, error: messageMediaError(verified.error) };
  }
  const { rows: mediaRows, uploadIds } = verified.media;
  // Publication envoyée : visible pour l'expéditeur, sans blocage
  let postId: string | null = null;
  if (input.kind === "post") {
    const post = await reachablePost(viewerId, input.postId);
    if (!post) return { ok: false, error: "notFound" };
    postId = post.id;
  }

  const now = new Date();
  const message = await db.$transaction(
    async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: viewerId,
          kind: input.kind,
          body: input.body,
          progress: progress ?? Prisma.DbNull,
          postId,
          mediaCount: mediaRows.length,
          createdAt: now,
        },
        select: messageSelect,
      });
      if (mediaRows.length > 0) {
        await tx.messageMedia.createMany({
          data: mediaRows.map((row) => ({ ...row, messageId: created.id })),
        });
        const { count } = await tx.mediaUpload.updateMany({
          where: { id: { in: uploadIds }, userId: viewerId, usedAt: null },
          data: { usedAt: now },
        });
        // Un même envoi ne sert qu'une fois
        if (count !== uploadIds.length) throw new Error("Média déjà utilisé");
      }
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: viewerId } },
        data: { lastReadAt: now },
      });
      return created;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  const [posts, media] = await Promise.all([
    sharedPostsFor(viewerId, postId ? [postId] : []),
    messageMediaFor(mediaRows.length > 0 ? [message.id] : []),
  ]);
  return {
    ok: true,
    message: toChatMessage(viewerId, message, undefined, posts, media),
  };
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

/**
 * Autorisations d'envoi des photos ou de la vidéo d'un message : seulement
 * dans une conversation où la personne peut écrire.
 */
export async function requestMessageUploads(
  viewerId: string,
  conversationId: string,
  files: UploadRequest,
): Promise<{ ok: true; slots: UploadSlot[] } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const access = await sendAccess(viewerId, conversationId);
  if (access !== "ok") return { ok: false, error: access };
  const result = await requestUploads(viewerId, files);
  return result.ok
    ? result
    : { ok: false, error: messageMediaError(result.error) };
}

/** Supprime son propre message pour tout le monde (le contenu est effacé). */
export async function deleteMessage(viewerId: string, messageId: string) {
  const { count } = await db.message.updateMany({
    where: {
      id: messageId,
      senderId: viewerId,
      deletedAt: null,
      kind: { not: "pact" },
    },
    data: {
      deletedAt: new Date(),
      body: "",
      progress: Prisma.DbNull,
      postId: null,
      mediaCount: 0,
    },
  });
  if (count > 0) {
    await db.messageReaction.deleteMany({ where: { messageId } });
    await removeMessageMedia(messageId);
  }
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
      kind: { not: "pact" },
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
