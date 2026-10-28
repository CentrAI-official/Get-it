"use server";

import { refresh } from "next/cache";
import {
  firstCommunityError,
  type CommunityError,
} from "@/features/community/rules";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import { createStory, deleteStory } from "@/server/stories/service";
import { storyInputSchema } from "./rules";

type Result = { ok: true } | { ok: false; error: CommunityError };

/** Publie une story (média déjà envoyé, revérifié par le serveur). */
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
