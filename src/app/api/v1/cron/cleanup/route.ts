import { purgeStaleUploads } from "@/server/community/media";
import { runCron } from "@/server/cron";

/** Ménage de la nuit : les photos et vidéos envoyées puis abandonnées (tâche planifiée). */
export async function GET(request: Request) {
  return runCron(request, () => purgeStaleUploads());
}
