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
  pageConversationKey,
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
import { signedUrls } from "@/server/storage/service";
import { visibleStory } from "@/server/stories/access";
import { getDisplayLevels } from "@/server/levels/service";
import { notify } from "@/server/notifications/service";
import { onlineContactIds } from "@/server/presence/service";
import {
  getOpenPact,
  pactCardsFor,
  settlePacts,
  type PactBanner,
  type PactCard,
} from "./pacts";
import {
  getGroupPact,
  settleGroupPacts,
  type GroupPactState,
} from "./group-pacts";

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
  /** Une page pro (nom et logo ci-dessus) : la personne qui la gère n'est pas montrée. */
  page: { id: string; handle: string } | null;
};

/** La page pro d'une conversation, telle que la voit chaque participant. */
export type ConversationPage = {
  id: string;
  handle: string;
  name: string;
  logoUrl: string | null;
  /** La personne qui lit gère cette page : elle répond en son nom. */
  mine: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  mine: boolean;
  kind: "text" | "progress" | "pact" | "post" | "story";
  /** Texte ; pour un pacte, l'étape (« proposed », « ended », « cancelled »). */
  body: string;
  progress: ProgressData | null;
  /**
   * Publication envoyée (message « post »), telle que la personne qui lit peut
   * la voir, ou « unavailable » (supprimée, retirée, auteur bloqué).
   */
  post: SharedPost | "unavailable" | null;
  /**
   * Story à laquelle le message répond (message « story ») : son aperçu tant
   * qu'elle est en ligne, sinon « unavailable ».
   */
  story: { thumbnailUrl: string } | "unavailable" | null;
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
  /** Conversation à deux avec un contact en ligne (rond orange). */
  online: boolean;
  lastMessage: {
    mine: boolean;
    kind: "text" | "progress" | "pact" | "post" | "story";
    body: string;
    deleted: boolean;
    /** Première photo ou vidéo jointe, pour l'aperçu sans texte. */
    media: "image" | "video" | null;
  };
  lastMessageAt: string;
};

/** Contact en ligne, avec sa conversation s'il y en a une (filtre « En ligne »). */
export type OnlineContact = {
  person: MessagePerson;
  conversationId: string | null;
};

export type ConversationState = {
  id: string;
  other: MessagePerson;
  /** L'autre personne est un contact en ligne. */
  otherOnline: boolean;
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
  /** Dernière lecture de l'autre personne (« Vu ») ; null tant qu'elle n'a pas accepté la conversation. */
  otherReadAt: string | null;
  /** Conversation avec une page pro : ni pacte, ni contact, ni présence. */
  page: ConversationPage | null;
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
  storyId: true,
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
  stories: Map<string, string> = new Map(),
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
    story:
      row.kind === "story" && !row.deletedAt
        ? row.storyId && stories.has(row.storyId)
          ? { thumbnailUrl: stories.get(row.storyId)! }
          : "unavailable"
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

/**
 * Aperçus des stories citées par des réponses, tant qu'elles sont en ligne :
 * la photo, ou l'image d'aperçu d'une vidéo (liens temporaires).
 */
async function storyThumbnails(storyIds: string[]) {
  const thumbnails = new Map<string, string>();
  if (storyIds.length === 0) return thumbnails;
  const rows = await db.story.findMany({
    where: {
      id: { in: [...new Set(storyIds)] },
      status: "visible",
      expiresAt: { gt: new Date() },
    },
    select: { id: true, kind: true, path: true, posterPath: true },
  });
  const pathOf = (row: (typeof rows)[number]) =>
    row.kind === "image" ? row.path : row.posterPath;
  const urls = await signedUrls(rows.flatMap((row) => pathOf(row) ?? []));
  for (const row of rows) {
    const path = pathOf(row);
    const url = path ? urls.get(path) : undefined;
    if (url) thumbnails.set(row.id, url);
  }
  return thumbnails;
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
      page: {
        select: {
          id: true,
          handle: true,
          name: true,
          logoPath: true,
          ownerId: true,
        },
      },
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
  return { id: conversation.id, viewer, other, page: conversation.page };
}

/**
 * Pour le membre qui écrit à une page : les messages de la page portent
 * l'identifiant de la page, jamais celui de la personne qui la gère.
 */
function maskPageSender(
  messages: ChatMessage[],
  page: { id: string; ownerId: string } | null,
  viewerId: string,
) {
  if (!page || page.ownerId === viewerId) return messages;
  return messages.map((message) =>
    message.mine ? message : { ...message, senderId: page.id },
  );
}

/** Une page pro présentée comme un interlocuteur : son nom et son logo. */
async function pagePerson(page: {
  id: string;
  handle: string;
  name: string;
  logoPath: string | null;
}): Promise<MessagePerson> {
  const urls = await avatarUrls([page.logoPath]);
  return {
    id: page.id,
    displayName: page.name,
    username: null,
    avatarUrl: page.logoPath ? (urls.get(page.logoPath) ?? null) : null,
    level: null,
    page: { id: page.id, handle: page.handle },
  };
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
        page: null,
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

/**
 * Ouvre la conversation avec une page pro (la crée au besoin). Une page reçoit
 * les messages directement, sans demande : c'est sa raison d'être.
 */
export async function startPageConversation(
  viewerId: string,
  pageId: string,
): Promise<{ ok: true; id: string } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true, owner: { select: { suspendedUntil: true } } },
  });
  if (!page || page.ownerId === viewerId) {
    return { ok: false, error: "notFound" };
  }
  if (page.owner.suspendedUntil && page.owner.suspendedUntil > new Date()) {
    return { ok: false, error: "notFound" };
  }
  if (await isBlockedPair(viewerId, page.ownerId)) {
    return { ok: false, error: "blocked" };
  }
  const key = pageConversationKey(pageId, viewerId);
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
        pageId,
        createdById: viewerId,
        members: {
          create: [
            { userId: viewerId, status: "accepted" },
            { userId: page.ownerId, status: "accepted" },
          ],
        },
      },
      select: { id: true },
    });
    return { ok: true, id: created.id };
  } catch (error) {
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

/**
 * Conversations visibles (avec au moins un message après une éventuelle
 * suppression). La Messagerie personnelle n'a pas celles de sa page ; avec
 * `pageId`, seulement celles de cette page (sa boîte, dans l'Espace pro).
 */
async function inboxRows(viewerId: string, pageId?: string) {
  const blocked = await getBlockedIds(viewerId);
  const rows = await db.conversationMember.findMany({
    where: {
      userId: viewerId,
      conversation: {
        messages: { some: {} },
        AND: [
          // À deux : jamais avec une personne bloquée ; un groupe reste visible
          {
            OR: [
              { groupId: { not: null } },
              { members: { none: { userId: { in: blocked } } } },
            ],
          },
          pageId
            ? { pageId, page: { ownerId: viewerId } }
            : {
                OR: [
                  { pageId: null },
                  { page: { ownerId: { not: viewerId } } },
                ],
              },
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
          page: {
            select: {
              id: true,
              handle: true,
              name: true,
              logoPath: true,
              ownerId: true,
            },
          },
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

/**
 * Boîte de réception : discussions et demandes reçues, les plus récentes
 * d'abord. Avec `pageId`, la boîte de sa page pro.
 */
export async function listInbox(
  viewerId: string,
  pageId?: string,
): Promise<{
  items: InboxItem[];
  online: OnlineContact[];
  loadedAt: number;
}> {
  const [rows, online] = await Promise.all([
    inboxRows(viewerId, pageId),
    pageId ? Promise.resolve(new Set<string>()) : onlineContactIds(viewerId),
  ]);
  const byId = await people([
    ...new Set([...rows.map((item) => item.otherId), ...online]),
  ]);
  // Écrire à une page : on voit la page, jamais la personne qui la gère
  const pages = new Map(
    await Promise.all(
      rows.flatMap(({ row }) => {
        const page = row.conversation.page;
        return page && page.ownerId !== viewerId
          ? [
              pagePerson(page).then(
                (person) => [row.conversation.id, person] as const,
              ),
            ]
          : [];
      }),
    ),
  );
  // Conversation déjà ouverte avec chaque contact en ligne
  const keys = new Map([...online].map((id) => [directKey(viewerId, id), id]));
  const conversations =
    keys.size > 0
      ? await db.conversation.findMany({
          where: { directKey: { in: [...keys.keys()] } },
          select: { id: true, directKey: true },
        })
      : [];
  const conversationOf = new Map(
    conversations.map((row) => [keys.get(row.directKey ?? ""), row.id]),
  );
  const items = rows.flatMap(({ row, last, otherId, unread }) => {
    const other = pages.get(row.conversation.id) ?? byId.get(otherId);
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
      online: !group && !row.conversation.page && online.has(otherId),
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
  const onlineList = [...online]
    .flatMap((id) => {
      const person = byId.get(id);
      return person
        ? [{ person, conversationId: conversationOf.get(id) ?? null }]
        : [];
    })
    .sort((a, b) =>
      (a.person.displayName ?? a.person.username ?? "").localeCompare(
        b.person.displayName ?? b.person.username ?? "",
        "fr",
      ),
    );
  return { items, online: onlineList, loadedAt: Date.now() };
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
    // Les discussions de groupe et avec une page ne sont pas des destinataires d'une personne
    if (row.conversation.group || row.conversation.page) continue;
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

/** La page pro de la personne (sa boîte de messages), ou null. */
async function ownPageId(viewerId: string) {
  const page = await db.page.findUnique({
    where: { ownerId: viewerId },
    select: { id: true },
  });
  return page?.id ?? null;
}

/** La boîte de messages de sa page pro ; null sans page. */
export async function listPageInbox(viewerId: string) {
  const pageId = await ownPageId(viewerId);
  return pageId ? listInbox(viewerId, pageId) : null;
}

/** Conversations non lues de sa page pro (0 sans page). */
export async function countPageUnread(viewerId: string) {
  const pageId = await ownPageId(viewerId);
  return pageId ? countUnread(viewerId, pageId) : 0;
}

/**
 * Conversations avec des messages non lus (pastille de l'onglet Messagerie ;
 * avec `pageId`, celle de la boîte de la page).
 */
export async function countUnread(viewerId: string, pageId?: string) {
  const rows = await inboxRows(viewerId, pageId);
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
  const [pacts, posts, media, stories] = await Promise.all([
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
    storyThumbnails(page.flatMap((row) => (row.storyId ? [row.storyId] : []))),
  ]);
  return {
    // Du plus ancien au plus récent, pour l'affichage
    messages: page
      .reverse()
      .map((row) => toChatMessage(viewerId, row, pacts, posts, media, stories)),
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
  if (membership.page) {
    return getPageConversation(viewerId, membership, membership.page);
  }
  await settlePacts(conversationId, viewerId);
  const [byId, viewerMessages, page, allowed, open, contact, online] =
    await Promise.all([
      people([membership.other.userId]),
      db.message.count({
        where: { conversationId, senderId: viewerId, kind: { not: "pact" } },
      }),
      messagesPage(viewerId, conversationId, membership.viewer.clearedAt),
      canWrite(viewerId),
      getOpenPact(viewerId, conversationId),
      getContactState(viewerId, membership.other.userId),
      onlineContactIds(viewerId),
    ]);
  const other = byId.get(membership.other.userId);
  if (!other) return null;
  return {
    id: membership.id,
    other,
    otherOnline: online.has(membership.other.userId),
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
    otherReadAt:
      membership.other.status === "accepted" && membership.other.lastReadAt
        ? membership.other.lastReadAt.toISOString()
        : null,
    page: null,
    loadedAt: Date.now(),
  };
}

/**
 * Une conversation avec une page pro. Pour le membre, l'interlocuteur est la
 * page ; pour la personne qui la gère, le membre, et elle répond au nom de la page.
 */
type Membership = NonNullable<Awaited<ReturnType<typeof loadMembership>>>;

async function getPageConversation(
  viewerId: string,
  membership: Membership,
  conversationPage: NonNullable<Membership["page"]>,
): Promise<ConversationState | null> {
  const mine = conversationPage.ownerId === viewerId;
  const [pageIdentity, byId, page, allowed] = await Promise.all([
    pagePerson(conversationPage),
    mine ? people([membership.other.userId]) : Promise.resolve(null),
    messagesPage(viewerId, membership.id, membership.viewer.clearedAt),
    canWrite(viewerId),
  ]);
  const other = mine ? byId?.get(membership.other.userId) : pageIdentity;
  if (!other) return null;
  return {
    id: membership.id,
    other,
    otherOnline: false,
    viewerStatus: membership.viewer.status,
    otherStatus: membership.other.status,
    permission: "ok",
    canWrite: allowed.ok,
    messages: maskPageSender(page.messages, conversationPage, viewerId),
    hasMore: page.hasMore,
    contact: "none",
    pact: null,
    // Pas de suggestion de pacte avec une page
    pactCount: 1,
    otherReadAt: membership.other.lastReadAt
      ? membership.other.lastReadAt.toISOString()
      : null,
    page: {
      id: conversationPage.id,
      handle: conversationPage.handle,
      name: conversationPage.name,
      logoUrl: pageIdentity.avatarUrl,
      mine,
    },
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
    const page = await messagesPage(
      viewerId,
      conversationId,
      membership.viewer.clearedAt,
      before,
    );
    return {
      ...page,
      messages: maskPageSender(page.messages, membership.page, viewerId),
    };
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
  /** Pacte de groupe ouvert (proposé ou en cours). */
  pact: GroupPactState | null;
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
  // Pactes arrivés au bout : terminés avant d'afficher la discussion
  await settleGroupPacts(conversationId, viewerId);
  const [page, allowed, blocked, pact] = await Promise.all([
    messagesPage(viewerId, conversationId, member.clearedAt),
    canWrite(viewerId),
    getBlockedIds(viewerId),
    getGroupPact(viewerId, conversationId),
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
    pact,
  };
}

/**
 * Peut écrire dans cette conversation ? Discussion de groupe : en être membre ;
 * à deux : les règles des demandes (`sendPermission`).
 */
async function sendAccess(
  viewerId: string,
  conversationId: string,
  kind: MessageInput["kind"],
): Promise<"ok" | MessageError> {
  if (await groupChatMember(viewerId, conversationId)) return "ok";
  const membership = await loadMembership(viewerId, conversationId);
  if (!membership) return "notFound";
  // Qui répond au nom d'une page n'y partage ni ses progrès ni ses stories
  if (
    membership.page?.ownerId === viewerId &&
    (kind === "progress" || kind === "story")
  ) {
    return "notFound";
  }
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
  | { kind: "post"; postId: string; body: string }
  | { kind: "story"; storyId: string; body: string };

/** Envoie un message (texte, ou progrès réel revérifié et figé par le serveur). */
export async function sendMessage(
  viewerId: string,
  conversationId: string,
  input: MessageInput,
): Promise<{ ok: true; message: ChatMessage } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const [access, recent] = await Promise.all([
    sendAccess(viewerId, conversationId, input.kind),
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
  // Réponse à une story : celle d'un autre membre de cette conversation à deux
  let storyId: string | null = null;
  if (input.kind === "story") {
    const story = await visibleStory(viewerId, input.storyId);
    const member = story
      ? await db.conversationMember.findFirst({
          where: {
            conversationId,
            userId: story.userId,
            conversation: { groupId: null, pageId: null },
          },
          select: { userId: true },
        })
      : null;
    if (!story || story.userId === viewerId || !member) {
      return { ok: false, error: "notFound" };
    }
    storyId = story.id;
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
          storyId,
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
  const [posts, media, stories] = await Promise.all([
    sharedPostsFor(viewerId, postId ? [postId] : []),
    messageMediaFor(mediaRows.length > 0 ? [message.id] : []),
    storyThumbnails(storyId ? [storyId] : []),
    notifyMessage(viewerId, conversationId),
  ]);
  return {
    ok: true,
    message: toChatMessage(viewerId, message, undefined, posts, media, stories),
  };
}

/** Prévient les autres membres de la discussion (une notification par discussion). */
async function notifyMessage(viewerId: string, conversationId: string) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      group: { select: { name: true } },
      page: { select: { id: true, ownerId: true } },
      members: {
        where: { userId: { not: viewerId } },
        select: { userId: true, status: true },
      },
    },
  });
  if (!conversation) return;
  const asPage =
    conversation.page?.ownerId === viewerId ? conversation.page.id : null;
  await Promise.all(
    conversation.members.map((member) =>
      notify({
        userId: member.userId,
        kind:
          !conversation.group && member.status === "request"
            ? "message_request"
            : "message",
        actorId: viewerId,
        actorPageId: asPage,
        href: `/messages/${conversationId}`,
        subject: conversation.group?.name ?? "",
        groupKey: `message:${conversationId}`,
      }),
    ),
  );
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
  const access = await sendAccess(viewerId, conversationId, "text");
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
