"use client";

import { ExternalLink, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { listPageInboxAction } from "@/features/messages/actions";
import { InboxRow } from "@/features/messages/components/inbox";
import { INBOX_POLL_MS } from "@/features/messages/rules";
import { Link } from "@/i18n/navigation";
import type { InboxItem } from "@/server/messages/service";

/**
 * La boîte de messages de la page : les membres qui écrivent à la page, à part
 * de la Messagerie personnelle. Rafraîchie toutes les 10 secondes.
 */
export function PageInbox({
  initial,
  loadedAt,
  pageName,
  handle,
}: {
  initial: InboxItem[];
  /** Moment du chargement : base des dates relatives. */
  loadedAt: number;
  pageName: string;
  handle: string;
}) {
  const t = useTranslations("Pages.inbox");
  const [items, setItems] = useState(initial);
  const [now, setNow] = useState(loadedAt);

  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const next = await listPageInboxAction().catch(() => null);
      if (!active || !next) return;
      setItems(next);
      setNow(Date.now());
    }
    void refresh();
    const timer = window.setInterval(refresh, INBOX_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title={t("emptyTitle")}
        description={t("emptyDescription", { page: pageName })}
        action={
          <Button asChild variant="outline">
            <Link href={`/pages/${handle}`}>
              <ExternalLink aria-hidden="true" />
              {t("viewPage")}
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <section aria-label={t("label")} className="flex flex-col gap-3">
      <p className="text-sm text-pretty text-muted-foreground">
        {t("hint", { page: pageName })}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <InboxRow item={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
