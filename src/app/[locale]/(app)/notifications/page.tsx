import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackButton } from "@/components/back-button";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { requireUser } from "@/server/auth/session";
import { getNotificationsPage } from "@/server/notifications/service";
import { getActingPage } from "@/server/pages/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: t("title") };
}

// Notifications : messages, demandes, invitations, pactes, commentaires et « J'aime »
export default function NotificationsPage() {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackButton fallback="/community" label={tCommon("back")} />
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
  // Celles du compte actif : le sien, ou celles de sa page
  const acting = await getActingPage(user.id);
  const page = await getNotificationsPage(user.id, acting?.id ?? null);
  return <NotificationList items={page.items} now={page.loadedAt} />;
}
