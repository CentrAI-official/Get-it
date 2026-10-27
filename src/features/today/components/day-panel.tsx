import { getLocale, getTranslations } from "next-intl/server";
import { DETAILS_PATH, ONBOARDING_PATH } from "@/features/auth/access";
import { redirect } from "@/i18n/navigation";
import { getDayPeriod } from "@/lib/day-period";
import { getDayPlan, isDayPanelDue } from "@/server/day/service";
import { avatarUrl } from "@/server/profile/avatar";
import { getRankedLevels } from "@/server/ranked/service";
import { getCurrentProfile } from "@/server/profile/service";
import { formatDayStamp } from "../day-stamp";
import { DayPanelDialog } from "./day-panel-dialog";

/**
 * « Ma journée », monté une fois dans la mise en page de l'application. Lit la
 * session : à placer dans un <Suspense>. Renvoie vers l'onboarding s'il n'est
 * pas terminé (ou vers les renseignements du compte s'il en manque), quelle
 * que soit la page demandée.
 */
export async function DayPanel() {
  const profile = await getCurrentProfile();
  if (!profile.onboardedAt) {
    redirect({ href: ONBOARDING_PATH, locale: await getLocale() });
  }
  // Comptes créés avant : date de naissance, sexe et région demandés une fois
  if (!profile.detailsComplete) {
    redirect({ href: DETAILS_PATH, locale: await getLocale() });
  }
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const now = new Date();
  const [plan, photo, ranked, locale, t] = await Promise.all([
    getDayPlan(profile.id, profile.timeZone, now),
    avatarUrl(profile.avatarPath),
    getRankedLevels(profile.id),
    getLocale(),
    getTranslations("App.today"),
  ]);
  const autoOpen = await isDayPanelDue(profile.id, plan.today);

  return (
    <DayPanelDialog
      plan={plan}
      autoOpen={autoOpen}
      stamp={formatDayStamp(now, locale, profile.timeZone)}
      greeting={t("greeting", {
        period: getDayPeriod(now, profile.timeZone),
        name: profile.displayName ?? "",
      })}
      name={profile.displayName ?? profile.email ?? ""}
      avatarUrl={photo}
      rankedLevel={ranked?.total ?? null}
    />
  );
}
