"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { setBillRemindersAction } from "../budget-actions";

/** « Me rappeler la veille » : une notification à 9 h, avec le nom du paiement seulement. */
export function BillReminders({ enabled }: { enabled: boolean }) {
  const t = useTranslations("Budget.bills");
  const id = useId();
  const [on, setOn] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-reminders`}
          checked={on}
          disabled={pending}
          onCheckedChange={(value) => {
            const next = value === true;
            setOn(next);
            setFailed(false);
            startTransition(async () => {
              if (!(await setBillRemindersAction(next))) {
                setOn(!next);
                setFailed(true);
              }
            });
          }}
          className="mt-0.5"
        />
        <label htmlFor={`${id}-reminders`} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("reminders")}</span>
          <span className="text-xs text-pretty text-muted-foreground">
            {t("remindersHint")}
          </span>
        </label>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("remindersError")}
        </p>
      ) : null}
    </div>
  );
}
