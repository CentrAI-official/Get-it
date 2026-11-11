import { sendEventReminders } from "@/server/community-events/service";
import { runCron } from "@/server/cron";

/** Rappel des événements 24 h avant (tâche planifiée, toutes les heures). */
export async function GET(request: Request) {
  return runCron(request, () => sendEventReminders());
}
