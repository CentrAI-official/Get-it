import "server-only";
import { AI_DAILY_LIMIT } from "@/features/coach/limits";
import type { AiRequestKind } from "@/generated/prisma/client";
import { toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import type { AiUsage } from "./types";

// Chaque fonction reçoit l'userId de la session et filtre dessus.

/** Données de l'utilisateur utiles à Get iT AI (sans passer par la langue de la page). */
export async function getAiProfile(userId: string) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      occupation: true,
      focusPillars: true,
      onboardedAt: true,
      settings: {
        select: {
          locale: true,
          timeZone: true,
          dailyMinutes: true,
          aiConsentAt: true,
        },
      },
    },
  });
  if (!profile) return null;
  return {
    displayName: profile.displayName,
    occupation: profile.occupation,
    focusPillars: profile.focusPillars,
    onboarded: profile.onboardedAt !== null,
    locale: profile.settings?.locale ?? "fr",
    timeZone: profile.settings?.timeZone ?? "America/Toronto",
    dailyMinutes: profile.settings?.dailyMinutes ?? null,
    consented: Boolean(profile.settings?.aiConsentAt),
    consentedAt: profile.settings?.aiConsentAt ?? null,
  };
}

/** Donne ou retire l'accord pour que Get iT AI reçoive les données (Loi 25). */
export async function setAiConsent(userId: string, consented: boolean) {
  await db.userSettings.updateMany({
    where: { userId },
    data: { aiConsentAt: consented ? new Date() : null },
  });
}

/** Requêtes encore possibles aujourd'hui (jour dans le fuseau de l'utilisateur). */
export async function getAiRequestsLeft(userId: string, timeZone: string) {
  const used = await db.aiRequest.count({
    where: {
      userId,
      day: toDbDate(toCalendarDay(new Date(), timeZone)),
    },
  });
  return Math.max(0, AI_DAILY_LIMIT - used);
}

/**
 * Réserve une requête dans la limite quotidienne, avant d'appeler le modèle :
 * une réponse interrompue compte quand même. Renvoie son id, ou null si la
 * limite est atteinte.
 */
export async function reserveAiRequest(
  userId: string,
  kind: AiRequestKind,
  timeZone: string,
) {
  const day = toDbDate(toCalendarDay(new Date(), timeZone));
  return db.$transaction(async (tx) => {
    const used = await tx.aiRequest.count({ where: { userId, day } });
    if (used >= AI_DAILY_LIMIT) return null;
    const request = await tx.aiRequest.create({
      data: { userId, kind, day, model: "pending" },
      select: { id: true },
    });
    return { id: request.id, remaining: AI_DAILY_LIMIT - used - 1 };
  });
}

/**
 * Rend une requête réservée quand l'appel a échoué avant de produire quoi que
 * ce soit (clé invalide, service indisponible) : elle ne compte pas.
 */
export async function releaseAiRequest(requestId: string) {
  await db.aiRequest.deleteMany({ where: { id: requestId } });
}

/** Jetons réellement consommés (suivi des coûts). */
export async function recordAiUsage(requestId: string, usage: AiUsage) {
  await db.aiRequest.update({
    where: { id: requestId },
    data: {
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
    },
  });
}
