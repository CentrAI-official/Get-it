"use client";

import { useEffect } from "react";
import { countUnreadAction } from "../actions";
import { UNREAD_POLL_MS } from "../rules";
import { reloadIfOutdated } from "@/lib/outdated";
import { onUnreadRefresh, setUnreadCount } from "../unread-store";

/**
 * Rafraîchit la pastille de la Messagerie toutes les 30 secondes, quand la
 * page est visible (pas encore de temps réel).
 */
export function UnreadPoller() {
  useEffect(() => {
    let active = true;
    // Une demande à la fois : réseau coupé, elle attend et les suivantes ne s'empilent pas
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      const next = await countUnreadAction().catch((error: unknown) => {
        reloadIfOutdated(error);
        return null;
      });
      busy = false;
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
