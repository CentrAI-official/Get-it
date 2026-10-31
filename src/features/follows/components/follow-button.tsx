"use client";

import { LoaderCircle, UserCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setFollowAction } from "../actions";

/** « Suivre » / « Abonné » : suivre un membre sans qu'il ait à accepter. */
export function FollowButton({
  userId,
  name,
  following,
  size = "default",
  className,
}: {
  userId: string;
  /** Nom de la personne (lecteurs d'écran). */
  name: string;
  following: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  const t = useTranslations("Follows");
  const [on, setOn] = useState(following);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setError(false);
    // Le bouton change tout de suite ; il revient si le serveur refuse
    setOn(next);
    startTransition(async () => {
      const result = await setFollowAction(userId, next);
      if (!result.ok) {
        setOn(!next);
        setError(true);
      }
    });
  }

  return (
    <span className="flex flex-col gap-1">
      <Button
        type="button"
        size={size}
        variant={on ? "outline" : "default"}
        aria-pressed={on}
        aria-label={
          on ? t("unfollowLabel", { name }) : t("followLabel", { name })
        }
        disabled={pending}
        onClick={toggle}
        className={cn(className)}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : on ? (
          <UserCheck aria-hidden="true" />
        ) : (
          <UserPlus aria-hidden="true" />
        )}
        {on ? t("following") : t("follow")}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {t("error")}
        </span>
      ) : null}
    </span>
  );
}
