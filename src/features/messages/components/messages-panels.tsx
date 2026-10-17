import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { recordIdSchema } from "@/features/goals/schemas";
import { Link } from "@/i18n/navigation";
import { getCommunityMember } from "@/server/community/members";
import { getConversation, listInbox } from "@/server/messages/service";
import { getCurrentProfile } from "@/server/profile/service";
import { ConversationView } from "./conversation-view";
import { Inbox } from "./inbox";
import { NewMessage } from "./new-message";

// Pages de la Messagerie. Chacune lit la session : à placer dans un <Suspense>.

/** La Messagerie est réservée aux membres du Centre. */
async function JoinFirst() {
  const t = await getTranslations("Messages.join");
  return (
    <EmptyState
      icon={MessageCircle}
      title={t("title")}
      description={t("description")}
      action={
        <Button asChild>
          <Link href="/community">{t("action")}</Link>
        </Button>
      }
    />
  );
}

export async function MessagesHome() {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinFirst />;
  const inbox = await listInbox(profile.id);
  return <Inbox initial={inbox.items} loadedAt={inbox.loadedAt} />;
}

export async function NewMessageGate() {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinFirst />;
  return <NewMessage />;
}

export async function ConversationLoader({ id }: { id: string }) {
  const profile = await getCurrentProfile();
  const conversationId = recordIdSchema.safeParse(id);
  if (!conversationId.success) notFound();
  const conversation = await getConversation(profile.id, conversationId.data);
  if (!conversation) notFound();
  return (
    <ConversationView initial={conversation} timeZone={profile.timeZone} />
  );
}

export function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-3 p-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-16 rounded-3xl" />
      <Skeleton className="ml-auto h-12 w-2/3 rounded-3xl" />
      <Skeleton className="h-12 w-1/2 rounded-3xl" />
      <Skeleton className="ml-auto h-12 w-1/3 rounded-3xl" />
    </div>
  );
}
