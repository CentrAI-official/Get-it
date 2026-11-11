import { getPaysToConfirm } from "@/server/budget/checklist";
import { getCurrentProfile } from "@/server/profile/service";
import { PayCheck } from "./pay-check";

/** Les paies à confirmer, pour la fenêtre du budget. À placer dans un <Suspense>. */
export async function PayCheckLoader() {
  const profile = await getCurrentProfile();
  const { pays, currency } = await getPaysToConfirm(profile.id);
  if (pays.length === 0) return null;
  return <PayCheck pays={pays} currency={currency} />;
}
