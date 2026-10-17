"use client";

import { useEffect } from "react";
import { countUnreadAction } from "../actions";
import { UNREAD_POLL_MS } from "../rules";
import { onUnreadRefresh, setUnreadCount } from "../unread-store";

/**
 * Rafraîchit la pastille de la Messagerie toutes les 30 secondes, quand la
 * page est visible (pas encore de temps réel).
 */
export function UnreadPoller() {
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const next = await countUnreadAction().catch(() => null);
      if (active && next !== null) setUnreadCount(next);
    }
    void refresh();
    const timer = window.setInterval(refresh, UNREAD_POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    const stop = onUnreadRefresh(() => void refresh());
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      stop();
    };
  }, []);

  return null;
}
