import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { requireUser } from "@/server/auth/session";
import { getNotificationsPage } from "@/server/notifications/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: t("title") };
}

// Notifications : messages, demandes, invitations, pactes, commentaires et « J'aime »
export default function NotificationsPage() {
  const t = useTranslations("Notifications");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-2xl" />
            ))}
          </div>
        }
      >
        <Notifications />
      </Suspense>
    </div>
  );
}

async function Notifications() {
  const user = await requireUser();
  const page = await getNotificationsPage(user.id);
  return <NotificationList items={page.items} now={page.loadedAt} />;
}
