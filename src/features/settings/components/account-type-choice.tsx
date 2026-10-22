"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { setAccountTypeAction } from "@/features/marketplace/actions";
import { ACCOUNT_TYPES, type AccountType } from "@/features/marketplace/rules";

/**
 * Changer de type de compte. Redevenir consommateur cache les annonces du
 * Marketplace sans les supprimer.
 */
export function AccountTypeChoice({
  current,
  labelledBy,
}: {
  current: AccountType;
  labelledBy: string;
}) {
  const t = useTranslations("Onboarding.account.types");
  const [value, setValue] = useOptimistic(current);
  const [pending, startTransition] = useTransition();

  return (
    <RadioGroup
      value={value}
      disabled={pending}
      aria-labelledby={labelledBy}
      onValueChange={(next) => {
        const type = ACCOUNT_TYPES.find((item) => item === next);
        if (!type) return;
        startTransition(async () => {
          setValue(type);
          await setAccountTypeAction(type);
        });
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      {ACCOUNT_TYPES.map((type) => (
        <label
          key={type}
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10"
        >
          <RadioGroupItem value={type} className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t(`${type}.title`)}</span>
            <span className="text-sm text-muted-foreground">
              {t(`${type}.description`)}
            </span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
