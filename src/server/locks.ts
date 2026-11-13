import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Une demande à la fois pour cette clé, jusqu'à la fin de la transaction
 * (verrou consultatif de PostgreSQL). Sans ça, deux demandes envoyées en même
 * temps comptent toutes les deux « 19 sur 20 » et passent la limite : à poser
 * avant de compter, dans la même transaction que l'écriture.
 */
export async function lockFor(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/** Levée dans une transaction quand la limite est atteinte : tout est annulé. */
export class LimitReached extends Error {
  constructor() {
    super("Limite atteinte");
    this.name = "LimitReached";
  }
}
