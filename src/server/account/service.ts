import "server-only";
import { db } from "@/server/db";

/**
 * Supprime définitivement un compte (Loi 25) : les données Get iT (le profil, et
 * par cascade les réglages, objectifs et évaluations), puis le compte Supabase
 * Auth et ses sessions. Les deux suppressions réussissent ou échouent ensemble.
 * `userId` vient toujours de la session.
 */
export async function deleteAccount(userId: string) {
  await db.$transaction([
    db.profile.deleteMany({ where: { id: userId } }),
    db.$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`,
  ]);
}
