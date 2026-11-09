import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { recordIdSchema } from "@/features/goals/schemas";
import { addDays, toCalendarDay } from "@/lib/dates";
import { getCommunityMember } from "@/server/community/members";
import { getEventForEdit } from "@/server/community-events/service";
import { db } from "@/server/db";
import { getGroup } from "@/server/groups/service";
import { getActingPage } from "@/server/pages/identity";
import { getCurrentProfile } from "@/server/profile/service";
import { CommunityEventForm } from "./community-event-form";

// Pages du formulaire. Chaque chargeur lit la session : à placer dans un <Suspense>.

/**
 * Créer un événement : demain à 18 h, dans ma région. Sur ma page pro, au nom
 * de la page ; depuis un groupe dont je suis membre (`groupId`), dans ce groupe.
 */
export async function NewCommunityEventLoader({
  groupId,
}: {
  groupId?: string;
}) {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const group = recordIdSchema.safeParse(groupId);
  const [details, acting, inGroup] = await Promise.all([
    db.profile.findUnique({
      where: { id: profile.id },
      select: { qcRegion: true },
    }),
    getActingPage(profile.id),
    group.success ? getGroup(profile.id, group.data) : null,
  ]);
  // Une page ne crée pas dans un groupe ; seulement un groupe dont on est membre
  const owner = acting
    ? { page: acting.name }
    : inGroup?.status === "active"
      ? { group: { id: inGroup.id, name: inGroup.name } }
      : null;
  const today = toCalendarDay(new Date(), profile.timeZone);
  return (
    <CommunityEventForm
      event={null}
      owner={owner}
      defaults={{
        day: addDays(today, 1),
        minute: 18 * 60,
        region: details?.qcRegion ?? null,
      }}
    />
  );
}

/** Modifier un événement : seulement l'hôte. */
export async function EditCommunityEventLoader({ id }: { id: string }) {
  const parsed = recordIdSchema.safeParse(id);
  if (!parsed.success) notFound();
  const profile = await getCurrentProfile();
  const event = await getEventForEdit(profile.id, parsed.data);
  if (!event || event.cancelled) notFound();
  return (
    <CommunityEventForm
      event={event}
      defaults={{
        day: event.startDay,
        minute: event.startMinute,
        region: null,
      }}
    />
  );
}

export function CommunityEventFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
