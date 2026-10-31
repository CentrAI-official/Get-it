"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  firstCommunityError,
  type CommunityError,
} from "@/features/community/rules";
import { recordIdSchema } from "@/features/goals/schemas";
import { MESSAGE_MAX_LENGTH } from "@/features/messages/rules";
import { requireUser } from "@/server/auth/session";
import { listMusic } from "@/server/stories/music";
import {
  answerQuestion,
  createStory,
  deleteStory,
  getStoryActivity,
  recordStoryView,
  replyToStory,
  storyStickerData,
  votePoll,
} from "@/server/stories/service";
import { MUSIC_TABS } from "./music";
import { storyInputSchema } from "./rules";
import { storyAnswerSchema } from "./studio";

type Result = { ok: true } | { ok: false; error: CommunityError };

/** Publie une story (média déjà envoyé, textes, stickers et musique revérifiés). */
export async function createStoryAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = storyInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: firstCommunityError(parsed.error) };
  try {
    const result = await createStory(user.id, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Story impossible à publier", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Supprime une de mes stories. */
export async function deleteStoryAction(storyId: unknown): Promise<Result> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(storyId);
  if (!id.success) return { ok: false, error: "notFound" };
  try {
    const result = await deleteStory(user.id, id.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Story impossible à supprimer", error);
    return { ok: false, error: "unexpected" };
  }
}

/** La story d'un contact est vue (liste « Vu par » de son auteur). */
export async function recordStoryViewAction(storyId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(storyId);
  if (!id.success) return false;
  return recordStoryView(user.id, id.data).catch(() => false);
}

/** Vote au sondage d'une story ; renvoie les votes. */
export async function votePollAction(storyId: unknown, choice: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(storyId);
  const parsed = z.union([z.literal(0), z.literal(1)]).safeParse(choice);
  if (!id.success || !parsed.success) {
    return { ok: false as const, error: "notFound" as const };
  }
  try {
    return await votePoll(user.id, id.data, parsed.data);
  } catch (error) {
    console.error("Vote impossible", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

/** Répond à la question d'une story. */
export async function answerQuestionAction(
  storyId: unknown,
  body: unknown,
): Promise<Result> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(storyId);
  const parsed = storyAnswerSchema.safeParse(body);
  if (!id.success) return { ok: false, error: "notFound" };
  if (!parsed.success) return { ok: false, error: "storyAnswerInvalid" };
  try {
    return await answerQuestion(user.id, id.data, parsed.data);
  } catch (error) {
    console.error("Réponse impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Répond à une story (texte ou réaction emoji) dans la Messagerie de l'auteur. */
export async function replyToStoryAction(storyId: unknown, body: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(storyId);
  const parsed = z
    .string()
    .trim()
    .min(1)
    .max(MESSAGE_MAX_LENGTH)
    .safeParse(body);
  if (!id.success || !parsed.success) {
    return { ok: false as const, error: "notFound" as const };
  }
  try {
    return await replyToStory(user.id, id.data, parsed.data);
  } catch (error) {
    console.error("Réponse à la story impossible", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

/** Activité d'une de mes stories : « Vu par », votes et réponses. */
export async function storyActivityAction(storyId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(storyId);
  if (!id.success) return null;
  return getStoryActivity(user.id, id.data).catch(() => null);
}

/** Morceaux d'un onglet de la musique : Tendances, Pour toi ou Recherche. */
export async function listMusicAction(tab: unknown, query: unknown) {
  const user = await requireUser();
  const parsedTab = z.enum(MUSIC_TABS).safeParse(tab);
  const parsedQuery = z
    .string()
    .max(60)
    .safeParse(query ?? "");
  if (!parsedTab.success || !parsedQuery.success) return [];
  return listMusic(user.id, parsedTab.data, parsedQuery.data).catch(
    (error: unknown) => {
      console.error("Musique introuvable", error);
      return [];
    },
  );
}

/** Contacts à mentionner et séries d'habitudes à montrer dans une story. */
export async function storyStickerDataAction() {
  const user = await requireUser();
  return storyStickerData(user.id).catch(() => ({ contacts: [], streaks: [] }));
}
