"use server";

import { refresh } from "next/cache";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import {
  removeContact,
  requestContact,
  respondToContact,
} from "@/server/contacts/service";
import type { ContactError, ContactState } from "./rules";

// Points d'entrée publics : session et identifiants revalidés ici ; le service
// vérifie l'adhésion au Centre et les blocages.

/** Ajoute quelqu'un en contact (ou accepte sa demande si elle existe déjà). */
export async function requestContactAction(
  userId: unknown,
): Promise<
  { ok: true; state: ContactState } | { ok: false; error: ContactError }
> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "notFound" };
  try {
    const result = await requestContact(user.id, id.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Demande de contact impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function respondContactAction(userId: unknown, accept: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(userId);
  if (!id.success || typeof accept !== "boolean") return false;
  const done = await respondToContact(user.id, id.data, accept).catch(
    () => false,
  );
  if (done) refresh();
  return done;
}

/** Retire un contact, ou annule sa demande. */
export async function removeContactAction(userId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(userId);
  if (!id.success) return false;
  const done = await removeContact(user.id, id.data).catch(() => false);
  if (done) refresh();
  return done;
}
