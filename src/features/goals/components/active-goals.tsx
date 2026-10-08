import { listActiveGoals } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { GoalList } from "./goal-list";
import { NoGoals } from "./no-goals";

/** Objectifs en cours de l'utilisateur connecté. Lit la session : à placer dans un <Suspense>. */
export async function ActiveGoals() {
  const profile = await getCurrentProfile();
  const goals = await listActiveGoals(profile.id);
  return goals.length > 0 ? <GoalList goals={goals} /> : <NoGoals />;
}
