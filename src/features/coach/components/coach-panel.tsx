import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isAiConfigured } from "@/server/ai/provider";
import { getAiProfile, getAiRequestsLeft } from "@/server/ai/usage";
import { getLatestConversation } from "@/server/coach/service";
import { getCurrentProfile } from "@/server/profile/service";
import { AiConsentCard } from "./ai-consent-card";
import { CoachChat } from "./coach-chat";

/**
 * Get iT AI : pas encore activé, accord à donner, ou conversation.
 * Lit la session : à placer dans un <Suspense>.
 */
export async function CoachPanel() {
  const profile = await getCurrentProfile();
  const t = await getTranslations("Coach");

  if (!isAiConfigured()) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t("notConfiguredTitle")}
        description={t("notConfiguredDescription")}
      />
    );
  }

  const ai = await getAiProfile(profile.id);
  if (!ai?.consented) return <AiConsentCard />;

  const [conversation, remaining] = await Promise.all([
    getLatestConversation(profile.id),
    getAiRequestsLeft(profile.id, profile.timeZone),
  ]);
  return (
    <CoachChat
      // Une autre conversation (ou une nouvelle) repart d'un état propre
      key={conversation?.id ?? "new"}
      conversation={conversation}
      remaining={remaining}
      name={profile.displayName}
    />
  );
}

export function CoachPanelSkeleton() {
  return <Skeleton className="h-[60dvh] rounded-3xl" />;
}
