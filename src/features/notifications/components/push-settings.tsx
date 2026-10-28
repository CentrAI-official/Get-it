"use client";

import { BellOff, BellRing, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from "../actions";

type Status =
  | "loading"
  /** Navigateur sans notifications (iPhone : ajouter Get iT à l'écran d'accueil). */
  | "unsupported"
  | "denied"
  | "off"
  | "on";

/** Clé publique VAPID (base64url) au format attendu par le navigateur. */
function keyBytes(base64: string) {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * Réglages › Notifications sur cet appareil : demande la permission, abonne ce
 * navigateur (service worker « /sw.js ») et l'enregistre dans le compte.
 */
export function PushSettings({ publicKey }: { publicKey: string }) {
  const t = useTranslations("Notifications.push");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    async function read(): Promise<Status> {
      if (!supported()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? "on" : "off";
    }
    void read()
      .catch((): Status => "unsupported")
      .then((next) => {
        if (active) setStatus(next);
      });
    return () => {
      active = false;
    };
  }, []);

  function enable() {
    setError(false);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        });
        const saved = await savePushSubscriptionAction(subscription.toJSON());
        if (!saved) {
          await subscription.unsubscribe();
          setError(true);
          return;
        }
        setStatus("on");
      } catch {
        setError(true);
      }
    });
  }

  function disable() {
    setError(false);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await removePushSubscriptionAction(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setStatus("off");
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {status === "loading" ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-5 animate-spin text-muted-foreground"
        />
      ) : status === "unsupported" ? (
        <p className="text-sm text-muted-foreground">{t("unsupported")}</p>
      ) : status === "denied" ? (
        <p className="text-sm text-muted-foreground">{t("denied")}</p>
      ) : status === "on" ? (
        <>
          <p className="flex items-center gap-2 text-sm">
            <BellRing aria-hidden="true" className="size-4 text-primary" />
            {t("on")}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={disable}
          >
            <BellOff aria-hidden="true" />
            {t("disable")}
          </Button>
        </>
      ) : (
        <Button type="button" disabled={pending} onClick={enable}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <BellRing aria-hidden="true" />
          )}
          {t("enable")}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
