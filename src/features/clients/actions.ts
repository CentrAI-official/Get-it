"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { recordIdSchema } from "@/features/goals/schemas";
import { usernameSchema } from "@/features/community/rules";
import { requireUser } from "@/server/auth/session";
import {
  acceptInvitation,
  addClientNote,
  cancelInvitation,
  declineInvitation,
  deleteClientNote,
  endByPage,
  inviteClient,
  leavePro,
  requestToBecomeClient,
  respondToClientRequest,
  updateShares,
} from "@/server/clients/service";
import { startClientConversation } from "@/server/messages/service";
import { getActingPage } from "@/server/pages/identity";
import {
  clientMessageSchema,
  firstClientError,
  noteSchema,
  sharesSchema,
  type ClientError,
} from "./rules";

// Points d'entrée publics du suivi des clients : session et saisies revalidées
// ici. Côté page, il faut être sur sa page (mode page) ; côté client, sur son
// compte personnel.

type Result = { ok: true } | { ok: false; error: ClientError };

/** Sa page, si l'écran est celui de la page (mode page). */
async function pageOf(userId: string) {
  return getActingPage(userId);
}

async function done(result: Result) {
  if (result.ok) refresh();
  return result;
}

const failed = (error: unknown): Result => {
  console.error("Suivi des clients : action impossible", error);
  return { ok: false, error: "unexpected" };
};

// ——— Côté page ———

export async function inviteClientAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const page = await pageOf(user.id);
  if (!page) return { ok: false, error: "notFound" };
  const parsed = z
    .object({
      // « @nom » ou « nom »
      username: z
        .string()
        .trim()
        .transform((value) => value.replace(/^@/, ""))
        .pipe(usernameSchema),
      message: clientMessageSchema.default(""),
    })
    .safeParse(input);
  if (!parsed.success) {
    const error = firstClientError(parsed.error);
    return { ok: false, error: error === "unexpected" ? "notFound" : error };
  }
  try {
    return await done(
      await inviteClient(
        user.id,
        page.id,
        parsed.data.username,
        parsed.data.message,
      ),
    );
  } catch (error) {
    return failed(error);
  }
}

export async function respondClientRequestAction(
  relationId: unknown,
  accept: unknown,
): Promise<Result> {
  const user = await requireUser();
  const page = await pageOf(user.id);
  const id = recordIdSchema.safeParse(relationId);
  if (!page || !id.success || typeof accept !== "boolean") {
    return { ok: false, error: "notFound" };
  }
  try {
    return await done(
      await respondToClientRequest(user.id, page.id, id.data, accept),
    );
  } catch (error) {
    return failed(error);
  }
}

export async function cancelInvitationAction(relationId: unknown) {
  const user = await requireUser();
  const page = await pageOf(user.id);
  const id = recordIdSchema.safeParse(relationId);
  if (!page || !id.success) return false;
  const ok = await cancelInvitation(user.id, page.id, id.data).catch(
    () => false,
  );
  if (ok) refresh();
  return ok;
}

export async function endClientAction(relationId: unknown) {
  const user = await requireUser();
  const page = await pageOf(user.id);
  const id = recordIdSchema.safeParse(relationId);
  if (!page || !id.success) return false;
  const ok = await endByPage(user.id, page.id, id.data).catch(() => false);
  if (ok) refresh();
  return ok;
}

export async function addClientNoteAction(
  clientId: unknown,
  body: unknown,
): Promise<Result> {
  const user = await requireUser();
  const page = await pageOf(user.id);
  const id = recordIdSchema.safeParse(clientId);
  if (!page || !id.success) return { ok: false, error: "notFound" };
  const text = noteSchema.safeParse(body);
  if (!text.success) return { ok: false, error: firstClientError(text.error) };
  try {
    return await done(
      await addClientNote(user.id, page.id, id.data, text.data),
    );
  } catch (error) {
    return failed(error);
  }
}

export async function deleteClientNoteAction(noteId: unknown) {
  const user = await requireUser();
  const page = await pageOf(user.id);
  const id = recordIdSchema.safeParse(noteId);
  if (!page || !id.success) return false;
  const ok = await deleteClientNote(user.id, page.id, id.data).catch(
    () => false,
  );
  if (ok) refresh();
  return ok;
}

/** Écrire à un client : la conversation de la page avec lui. */
export async function writeToClientAction(
  clientId: unknown,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const user = await requireUser();
  const page = await pageOf(user.id);
  const id = recordIdSchema.safeParse(clientId);
  if (!page || !id.success) return { ok: false };
  try {
    const result = await startClientConversation(user.id, page.id, id.data);
    return result.ok ? result : { ok: false };
  } catch (error) {
    console.error("Conversation avec un client impossible", error);
    return { ok: false };
  }
}

// ——— Côté client ———

/** Les actions du client se font sur son compte personnel. */
async function personal(userId: string) {
  return (await getActingPage(userId)) === null;
}

export async function requestClientAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  if (!(await personal(user.id))) return { ok: false, error: "notFound" };
  const parsed = z
    .object({
      pageId: z.uuid(),
      shares: sharesSchema,
      message: clientMessageSchema.default(""),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstClientError(parsed.error) };
  }
  try {
    return await done(
      await requestToBecomeClient(
        user.id,
        parsed.data.pageId,
        parsed.data.shares,
        parsed.data.message,
      ),
    );
  } catch (error) {
    return failed(error);
  }
}

export async function acceptInvitationAction(
  relationId: unknown,
  shares: unknown,
): Promise<Result> {
  const user = await requireUser();
  if (!(await personal(user.id))) return { ok: false, error: "notFound" };
  const id = recordIdSchema.safeParse(relationId);
  const parsed = sharesSchema.safeParse(shares);
  if (!id.success) return { ok: false, error: "notFound" };
  if (!parsed.success) {
    return { ok: false, error: firstClientError(parsed.error) };
  }
  try {
    return await done(await acceptInvitation(user.id, id.data, parsed.data));
  } catch (error) {
    return failed(error);
  }
}

export async function declineInvitationAction(relationId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(relationId);
  if (!id.success) return false;
  const ok = await declineInvitation(user.id, id.data).catch(() => false);
  if (ok) refresh();
  return ok;
}

export async function updateSharesAction(
  relationId: unknown,
  shares: unknown,
): Promise<Result> {
  const user = await requireUser();
  if (!(await personal(user.id))) return { ok: false, error: "notFound" };
  const id = recordIdSchema.safeParse(relationId);
  const parsed = sharesSchema.safeParse(shares);
  if (!id.success) return { ok: false, error: "notFound" };
  if (!parsed.success) {
    return { ok: false, error: firstClientError(parsed.error) };
  }
  try {
    return await done(await updateShares(user.id, id.data, parsed.data));
  } catch (error) {
    return failed(error);
  }
}

export async function leaveProAction(relationId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(relationId);
  if (!id.success) return false;
  const ok = await leavePro(user.id, id.data).catch(() => false);
  if (ok) refresh();
  return ok;
}
