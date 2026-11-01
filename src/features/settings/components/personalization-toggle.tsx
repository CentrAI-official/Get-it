"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { setPersonalizationAction } from "../actions";

/** « Personnaliser mon expérience » : désactivé par défaut (Loi 25). */
export function PersonalizationToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations("App.settings.personalization");
  const id = useId();
  const [on, setOn] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-personalization`}
          checked={on}
          disabled={pending}
          onCheckedChange={(value) => {
            const next = value === true;
            setOn(next);
            setFailed(false);
            startTransition(async () => {
              if (!(await setPersonalizationAction(next))) {
                setOn(!next);
                setFailed(true);
              }
            });
          }}
          className="mt-0.5"
        />
        <label
          htmlFor={`${id}-personalization`}
          className="flex flex-col gap-0.5"
        >
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
