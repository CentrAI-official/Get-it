"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { countUnreadNotificationsAction } from "../actions";
import { NOTIFICATION_POLL_MS } from "../rules";
import { setNotificationCount, useNotificationCount } from "../store";

/** La cloche du haut, avec le nombre de notifications non lues. */
export function NotificationBell({ active }: { active: boolean }) {
  const t = useTranslations("Notifications");
  const count = useNotificationCount();
  return (
    <Link
      href="/notifications"
      aria-current={active ? "page" : undefined}
      aria-label={count > 0 ? t("bellUnread", { count }) : t("title")}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        active && "text-primary hover:text-primary",
      )}
    >
      <Bell aria-hidden="true" className="size-5 lg:size-4" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] leading-none font-bold text-primary-foreground tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Rafraîchit la pastille de la cloche toutes les 30 secondes, quand la page
 * est visible (pas encore de temps réel).
 */
export function NotificationPoller() {
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const next = await countUnreadNotificationsAction().catch(() => null);
      if (active && next !== null) setNotificationCount(next);
    }
    void refresh();
    const timer = window.setInterval(refresh, NOTIFICATION_POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return null;
}
