import { toCalendarDay } from "@/lib/dates";
import { isDayPanelDue } from "@/server/day/service";
import { weekQuestionDue } from "@/server/feedback/service";
import { getActingPage } from "@/server/pages/identity";
import { getCurrentProfile } from "@/server/profile/service";
import { WeekQuestionDialog } from "./week-question-dialog";

/**
 * Question posée une fois, une semaine après l'inscription, montée dans la mise
 * en page de l'application. Jamais le même jour avant « Ma journée » : elle
 * attend qu'il se soit déjà ouvert aujourd'hui. Lit la session : à placer dans
 * un <Suspense>.
 */
export async function WeekQuestion() {
  const profile = await getCurrentProfile();
  if (!profile.onboardedAt) return null;
  // Pas sur sa page : la question porte sur son usage personnel
  if (await getActingPage(profile.id)) return null;
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const now = new Date();
  const [due, dayPanelDue] = await Promise.all([
    weekQuestionDue(profile.id, now),
    isDayPanelDue(profile.id, toCalendarDay(now, profile.timeZone)),
  ]);
  if (!due || dayPanelDue) return null;
  return <WeekQuestionDialog />;
}
