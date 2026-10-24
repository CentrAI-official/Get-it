"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import {
  saveJournalEntry,
  type SaveJournalResult,
} from "@/server/journal/service";
import { getUserTimeZone } from "@/server/profile/service";
import { journalEntrySchema } from "./rules";

/**
 * Enregistre une page du journal. Le jour vient du formulaire, mais le serveur
 * revérifie qu'il est encore modifiable dans le fuseau de l'utilisateur.
 */
export async function saveJournalAction(
  input: unknown,
): Promise<SaveJournalResult | { ok: false; error: "invalid" | "unexpected" }> {
  const user = await requireUser();
  const parsed = journalEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const timeZone = await getUserTimeZone(user.id);
    const result = await saveJournalEntry(user.id, timeZone, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Page du journal impossible à enregistrer", error);
    return { ok: false, error: "unexpected" };
  }
}
