import "server-only";
import {
  CLIENT_ERROR_LIMIT,
  routeFromRoutePath,
  scrubErrorMessage,
  SERVER_ERROR_LIMIT,
  type ClientError,
} from "@/features/analytics/errors";
import { RATE_WINDOW_MS } from "@/features/analytics/rules";
import { resolvePath } from "@/features/analytics/sections";
import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";

// Erreurs de l'application pour le dashboard de l'équipe : jamais l'adresse
// complète ni de données personnelles (message nettoyé). L'enregistrement ne
// doit jamais provoquer une autre erreur : tout échec est seulement journalisé.

/** Erreur reçue du navigateur d'une personne connectée. */
export async function recordClientError(
  userId: string,
  error: ClientError,
  now = new Date(),
) {
  try {
    const recent = await db.appError.count({
      where: {
        userId,
        createdAt: { gte: new Date(now.getTime() - RATE_WINDOW_MS) },
      },
    });
    if (recent >= CLIENT_ERROR_LIMIT) return;
    await db.appError.create({
      data: {
        userId,
        source: "client",
        message: scrubErrorMessage(error.name, error.message),
        digest: error.digest ?? null,
        route: resolvePath(error.path).route,
        env: getServerEnv().VERCEL_ENV,
      },
    });
  } catch (failure) {
    console.error("Erreur du navigateur non enregistrée", failure);
  }
}

/** Erreurs serveur enregistrées pendant la minute en cours, par instance. */
let serverWindow = { start: 0, count: 0 };

/** Erreur attrapée par Next (instrumentation.ts › onRequestError). */
export async function recordServerError(
  error: unknown,
  routePath: string,
  now = new Date(),
) {
  if (now.getTime() - serverWindow.start > 60_000) {
    serverWindow = { start: now.getTime(), count: 0 };
  }
  if (++serverWindow.count > SERVER_ERROR_LIMIT) return;
  const name = error instanceof Error ? error.name : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest).slice(0, 80)
      : null;
  try {
    await db.appError.create({
      data: {
        source: "server",
        message: scrubErrorMessage(name, message),
        digest,
        route: routeFromRoutePath(routePath),
        env: getServerEnv().VERCEL_ENV,
      },
    });
  } catch (failure) {
    console.error("Erreur serveur non enregistrée", failure);
  }
}
