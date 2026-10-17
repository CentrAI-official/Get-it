"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "../unread-store";

/** Pastille de l'onglet Messagerie : conversations avec des messages non lus. */
export function UnreadBadge({ className }: { className?: string }) {
  const t = useTranslations("Messages");
  const count = useUnreadCount();
  if (count === 0) return null;

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[0.6rem] leading-none font-bold text-primary-foreground",
          className,
        )}
      >
        {count > 9 ? "9+" : count}
      </span>
      <span className="sr-only">{t("unreadLabel", { count })}</span>
    </>
  );
}
