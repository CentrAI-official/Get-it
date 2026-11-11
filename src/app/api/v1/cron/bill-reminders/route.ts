import { sendBillReminders } from "@/server/budget/checklist";
import { runCron } from "@/server/cron";

/** Rappel des paiements fixes la veille à 9 h (tâche planifiée, toutes les heures). */
export async function GET(request: Request) {
  return runCron(request, () => sendBillReminders());
}
