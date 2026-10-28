"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { recordIdSchema } from "@/features/goals/schemas";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/server/auth/session";
import {
  createGroup,
  deleteGroup,
  inviteToGroup,
  joinGroup,
  leaveGroup,
  listGroupMembers,
  removeGroupMember,
  removeGroupPost,
  respondToGroupInvite,
  setGroupRole,
  updateGroup,
  type GroupMemberItem,
} from "@/server/groups/service";
import { searchMembers } from "@/server/messages/service";
import { memberSearchSchema } from "@/features/messages/rules";
import { firstGroupError, groupFormSchema, type GroupError } from "./rules";

// Points d'entrée publics des Groupes : session et entrées revalidées ici ;
// le service revérifie le rôle de la personne dans chaque groupe.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: GroupError };

export type GroupFormState = {
  status: "idle" | "error";
  error?: GroupError;
  values?: Record<string, string>;
};

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

function formInput(formData: FormData) {
  return {
    locale: read(formData, "locale"),
    name: read(formData, "name"),
    description: read(formData, "description"),
    topic: read(formData, "topic"),
    visibility: read(formData, "visibility"),
  };
}

/** Crée un groupe, puis ouvre sa page. */
export async function createGroupAction(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const values = formInput(formData);
  const parsed = groupFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", error: firstGroupError(parsed.error), values };
  }
  let id: string;
  try {
    const result = await createGroup(user.id, parsed.data);
    if (!result.ok) return { status: "error", error: result.error, values };
    id = result.id;
  } catch (error) {
    console.error("Groupe impossible à créer", error);
    return { status: "error", error: "unexpected", values };
  }
  return redirect({ href: `/groups/${id}`, locale: parsed.data.locale });
}

/** Modifie le nom, la description ou le pilier, puis revient au groupe. */
export async function updateGroupAction(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const values = formInput(formData);
  const id = recordIdSchema.safeParse(read(formData, "groupId"));
  const parsed = groupFormSchema.safeParse(values);
  if (!id.success) return { status: "error", error: "notFound", values };
  if (!parsed.success) {
    return { status: "error", error: firstGroupError(parsed.error), values };
  }
  try {
    const result = await updateGroup(user.id, id.data, parsed.data);
    if (!result.ok) return { status: "error", error: result.error, values };
  } catch (error) {
    console.error("Groupe impossible à modifier", error);
    return { status: "error", error: "unexpected", values };
  }
  return redirect({ href: `/groups/${id.data}`, locale: parsed.data.locale });
}

/** Exécute une décision sur un groupe et rafraîchit la page si elle réussit. */
async function run<T extends object>(
  task: () => Promise<Result<T>>,
  label: string,
): Promise<Result<T>> {
  try {
    const result = await task();
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error(label, error);
    return { ok: false, error: "unexpected" };
  }
}

const ids = (...values: unknown[]) => {
  const parsed = values.map((value) => recordIdSchema.safeParse(value));
  return parsed.every((item) => item.success)
    ? parsed.map((item) => item.data as string)
    : null;
};

export async function joinGroupAction(groupId: unknown): Promise<Result> {
  const user = await requireUser();
  const [id] = ids(groupId) ?? [];
  if (!id) return { ok: false, error: "notFound" };
  return run(() => joinGroup(user.id, id), "Impossible de rejoindre le groupe");
}

export async function leaveGroupAction(groupId: unknown): Promise<Result> {
  const user = await requireUser();
  const [id] = ids(groupId) ?? [];
  if (!id) return { ok: false, error: "notFound" };
  return run(() => leaveGroup(user.id, id), "Impossible de quitter le groupe");
}

export async function inviteToGroupAction(
  groupId: unknown,
  userId: unknown,
): Promise<Result> {
  const user = await requireUser();
  const [group, target] = ids(groupId, userId) ?? [];
  if (!group || !target) return { ok: false, error: "notFound" };
  return run(
    () => inviteToGroup(user.id, group, target),
    "Invitation impossible",
  );
}

export async function respondToGroupInviteAction(
  groupId: unknown,
  accept: unknown,
): Promise<Result<{ conversationId: string | null }>> {
  const user = await requireUser();
  const [id] = ids(groupId) ?? [];
  const answer = z.boolean().safeParse(accept);
  if (!id || !answer.success) return { ok: false, error: "notFound" };
  return run(
    () => respondToGroupInvite(user.id, id, answer.data),
    "Réponse à l'invitation impossible",
  );
}

export async function removeGroupMemberAction(
  groupId: unknown,
  userId: unknown,
): Promise<Result> {
  const user = await requireUser();
  const [group, target] = ids(groupId, userId) ?? [];
  if (!group || !target) return { ok: false, error: "notFound" };
  return run(
    () => removeGroupMember(user.id, group, target),
    "Membre impossible à retirer",
  );
}

export async function setGroupRoleAction(
  groupId: unknown,
  userId: unknown,
  role: unknown,
): Promise<Result> {
  const user = await requireUser();
  const [group, target] = ids(groupId, userId) ?? [];
  const next = z.enum(["admin", "member"]).safeParse(role);
  if (!group || !target || !next.success)
    return { ok: false, error: "notFound" };
  return run(
    () => setGroupRole(user.id, group, target, next.data),
    "Rôle impossible à changer",
  );
}

/** Supprime le groupe (le créateur), puis revient aux Groupes (privé : à la Messagerie). */
export async function deleteGroupAction(
  groupId: unknown,
  locale: unknown,
): Promise<Result> {
  const user = await requireUser();
  const [id] = ids(groupId) ?? [];
  const lang = z.enum(["fr", "en"]).safeParse(locale);
  if (!id || !lang.success) return { ok: false, error: "notFound" };
  let back: "/groups" | "/messages" = "/groups";
  try {
    const result = await deleteGroup(user.id, id);
    if (!result.ok) return result;
    if (result.visibility === "private") back = "/messages";
  } catch (error) {
    console.error("Groupe impossible à supprimer", error);
    return { ok: false, error: "unexpected" };
  }
  return redirect({ href: back, locale: lang.data });
}

/** Retire une publication du forum (le créateur ou un admin du groupe). */
export async function removeGroupPostAction(postId: unknown): Promise<Result> {
  const user = await requireUser();
  const [id] = ids(postId) ?? [];
  if (!id) return { ok: false, error: "notFound" };
  return run(
    () => removeGroupPost(user.id, id),
    "Publication impossible à retirer",
  );
}

export async function listGroupMembersAction(
  groupId: unknown,
): Promise<GroupMemberItem[]> {
  const user = await requireUser();
  const [id] = ids(groupId) ?? [];
  if (!id) return [];
  return (await listGroupMembers(user.id, id)) ?? [];
}

/** Membres du Centre à inviter, par @nom ou par prénom. */
export async function searchInviteesAction(query: unknown) {
  const user = await requireUser();
  const parsed = memberSearchSchema.safeParse(query);
  if (!parsed.success) return [];
  return searchMembers(user.id, parsed.data);
}
