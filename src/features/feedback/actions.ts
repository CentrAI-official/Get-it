"use server";

import { requireUser } from "@/server/auth/session";
import { answerWeekQuestion, sendFeedback } from "@/server/feedback/service";
import { feedbackSchema, weekAnswerSchema, type FeedbackError } from "./rules";

// Chaque Server Action est un point d'entrée public : toute entrée est revalidée ici.

export type FeedbackFormState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; error: FeedbackError };

/** Avis libre, depuis Réglages › Donner mon avis. */
export async function sendFeedbackAction(
  _previous: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const user = await requireUser();
  const parsed = feedbackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid" };
  try {
    const result = await sendFeedback(user.id, parsed.data);
    return result.ok
      ? { status: "sent" }
      : { status: "error", error: result.error };
  } catch (error) {
    console.error("Avis non enregistré", error);
    return { status: "error", error: "unexpected" };
  }
}

/** Réponse à la question d'une semaine ; null : « Non merci ». */
export async function answerWeekQuestionAction(answer: unknown) {
  const user = await requireUser();
  const parsed = answer === null ? null : weekAnswerSchema.safeParse(answer);
  if (parsed && !parsed.success) return false;
  try {
    await answerWeekQuestion(user.id, parsed ? parsed.data : null);
    return true;
  } catch (error) {
    console.error("Réponse à la question d'une semaine non enregistrée", error);
    return false;
  }
}
