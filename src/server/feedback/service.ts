import "server-only";
import {
  FEEDBACK_DAILY_LIMIT,
  isWeekQuestionDue,
  WEEK_KIND,
  type FeedbackError,
  type FeedbackKind,
  type FeedbackTopic,
} from "@/features/feedback/rules";
import { db } from "@/server/db";

// Avis des membres envoyés à l'équipe (Réglages › Donner mon avis) et question
// posée une fois, après une semaine. Lus dans le dashboard de l'équipe, avec le
// nom d'utilisateur (le formulaire le dit) ; effacés avec le compte.

export type FeedbackResult = { ok: true } | { ok: false; error: FeedbackError };

export async function sendFeedback(
  userId: string,
  input: { kind: FeedbackKind; body: string },
  now = new Date(),
): Promise<FeedbackResult> {
  const recent = await db.feedback.count({
    where: {
      userId,
      kind: { not: WEEK_KIND },
      createdAt: { gte: new Date(now.getTime() - 86_400_000) },
    },
  });
  if (recent >= FEEDBACK_DAILY_LIMIT)
    return { ok: false, error: "limitReached" };
  await db.feedback.create({
    data: { userId, kind: input.kind, body: input.body },
  });
  return { ok: true };
}

/** La question d'une semaine est-elle à poser à cette personne ? */
export async function weekQuestionDue(userId: string, now = new Date()) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      settings: { select: { feedbackPromptAt: true } },
    },
  });
  if (!profile) return false;
  return isWeekQuestionDue(
    profile.createdAt,
    profile.settings?.feedbackPromptAt ?? null,
    now,
  );
}

/**
 * Réponse à la question d'une semaine, ou refus (null). Une seule fois : une
 * deuxième réponse est ignorée.
 */
export async function answerWeekQuestion(
  userId: string,
  answer: { topic: FeedbackTopic; body: string | null } | null,
  now = new Date(),
) {
  await db.$transaction(async (tx) => {
    const settings = await tx.userSettings.findUnique({
      where: { userId },
      select: { feedbackPromptAt: true },
    });
    if (settings?.feedbackPromptAt) return;
    await tx.userSettings.upsert({
      where: { userId },
      update: { feedbackPromptAt: now },
      create: { userId, feedbackPromptAt: now },
    });
    if (answer) {
      await tx.feedback.create({
        data: {
          userId,
          kind: WEEK_KIND,
          topic: answer.topic,
          body: answer.body,
        },
      });
    }
  });
}
