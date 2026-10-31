"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { setPresenceAction } from "../actions";

/** « Montrer quand je suis en ligne » : réciproque, comme Instagram. */
export function PresenceToggle({ shown }: { shown: boolean }) {
  const t = useTranslations("App.settings.presence");
  const id = useId();
  const [on, setOn] = useState(shown);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-presence`}
          checked={on}
          disabled={pending}
          onCheckedChange={(value) => {
            const next = value === true;
            setOn(next);
            setFailed(false);
            startTransition(async () => {
              if (!(await setPresenceAction(next))) {
                setOn(!next);
                setFailed(true);
              }
            });
          }}
          className="mt-0.5"
        />
        <label htmlFor={`${id}-presence`} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("label")}</span>
          <span className="text-sm text-muted-foreground">{t("hint")}</span>
        </label>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
