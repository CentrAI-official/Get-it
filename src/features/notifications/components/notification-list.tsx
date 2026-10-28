"use client";

import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/server/notifications/service";
import { markNotificationsReadAction } from "../actions";
import { notificationText } from "../rules";
import { setNotificationCount } from "../store";

/** Mes notifications ; les ouvrir les marque comme lues (la pastille disparaît). */
export function NotificationList({
  items,
  now,
}: {
  items: NotificationItem[];
  /** Heure du serveur au rendu (« il y a 2 h »). */
  now: number;
}) {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const unread = items.some((item) => !item.read);

  useEffect(() => {
    if (!unread) return;
    void markNotificationsReadAction().then(() => setNotificationCount(0));
  }, [unread]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const name = item.actor?.name ?? "Get iT";
        const text = notificationText(item.kind, {
          name,
          subject: item.subject,
          count: item.count,
        });
        return (
          <li key={item.id} className="border-b border-foreground/8">
            <Link
              href={item.href as `/${string}`}
              className={cn(
                "-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50",
                !item.read && "bg-primary/[0.06]",
              )}
            >
              <Avatar
                name={name}
                url={item.actor?.avatarUrl ?? null}
                className="size-11 shrink-0"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("text-sm", !item.read && "font-semibold")}>
                  {t(`items.${text.key}`, text.values)}
                </span>
                <time
                  dateTime={item.at}
                  className="text-xs text-muted-foreground"
                >
                  {format.relativeTime(new Date(item.at), now)}
                </time>
              </span>
              {item.read ? null : (
                <span className="flex shrink-0 items-center">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full bg-primary"
                  />
                  <span className="sr-only">{t("unread")}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
