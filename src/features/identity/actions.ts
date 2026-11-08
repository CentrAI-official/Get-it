"use server";

import { isIdentity } from "@/config/identity";
import { requireUser } from "@/server/auth/session";
import { setIdentity } from "@/server/pages/identity";

/** Passe à sa page pro, ou revient à son compte personnel (sur cet appareil). */
export async function switchIdentityAction(
  target: unknown,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isIdentity(target)) return { ok: false };
  return { ok: await setIdentity(user.id, target) };
}
