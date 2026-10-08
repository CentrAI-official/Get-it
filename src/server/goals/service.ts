import "server-only";
import { db } from "@/server/db";

/** Objectifs en cours, du plus ancien au plus récent. `userId` vient toujours de la session. */
export async function listActiveGoals(userId: string) {
  return db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, pillar: true },
  });
}
