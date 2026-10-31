"use server";

import { refresh } from "next/cache";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import { setFollow } from "@/server/follows/service";

/** Suivre un membre, ou ne plus le suivre. */
export async function setFollowAction(userId: unknown, follow: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(userId);
  if (!id.success || typeof follow !== "boolean") {
    return { ok: false as const, error: "notFound" as const };
  }
  try {
    const result = await setFollow(user.id, id.data, follow);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Abonnement impossible", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}
