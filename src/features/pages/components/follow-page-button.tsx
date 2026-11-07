"use client";

import { LoaderCircle, UserCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setPageFollowAction } from "../actions";

/**
 * « Suivre » / « Abonné » une page pro, avec son nombre d'abonnés : ses
 * publications vont dans le fil « Abonnements ».
 */
export function FollowPageButton({
  pageId,
  name,
  following,
  followers,
}: {
  pageId: string;
  /** Nom de la page (lecteurs d'écran). */
  name: string;
  following: boolean;
  followers: number;
}) {
  const t = useTranslations("Follows");
  const [on, setOn] = useState(following);
  const [count, setCount] = useState(followers);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setError(false);
    // Le bouton change tout de suite ; il revient si le serveur refuse
    setOn(next);
    setCount((value) => Math.max(0, value + (next ? 1 : -1)));
    startTransition(async () => {
      const result = await setPageFollowAction(pageId, next);
      if (!result.ok) {
        setOn(!next);
        setCount((value) => Math.max(0, value + (next ? -1 : 1)));
        setError(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          variant="outline"
          aria-pressed={on}
          aria-label={
            on ? t("unfollowLabel", { name }) : t("followLabel", { name })
          }
          disabled={pending}
          onClick={toggle}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : on ? (
            <UserCheck aria-hidden="true" className="text-primary" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          {on ? t("following") : t("follow")}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {t("followers", { count })}
        </span>
      </div>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {t("error")}
        </span>
      ) : null}
    </div>
  );
}
