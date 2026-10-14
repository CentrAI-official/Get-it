"use server";

import { refresh } from "next/cache";
import type { ConfirmState } from "@/components/confirm-dialog";
import { requireUser } from "@/server/auth/session";
import { setAiConsent } from "@/server/ai/usage";
import { deleteCoachConversations } from "@/server/coach/service";

// Points d'entrée publics : la session est revérifiée ici.

/** Donne ou retire l'accord pour Get iT AI (Loi 25). */
export async function setAiConsentAction(consented: boolean) {
  const user = await requireUser();
  if (typeof consented !== "boolean") return;
  try {
    await setAiConsent(user.id, consented);
  } catch (error) {
    console.error("Accord Get iT AI impossible à enregistrer", error);
  }
  refresh();
}

/** Efface toutes les conversations avec Get iT AI. */
export async function deleteCoachConversationsAction(): Promise<ConfirmState> {
  const user = await requireUser();
  try {
    await deleteCoachConversations(user.id);
  } catch (error) {
    console.error("Suppression des conversations impossible", error);
    return { status: "error" };
  }
  refresh();
  return { status: "success" };
}
