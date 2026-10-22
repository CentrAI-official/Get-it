"use client";

import { Sprout, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPES } from "@/features/marketplace/rules";
import type { StepProps } from "./step-props";

const ICONS = { consumer: Sprout, affiliate: Store } as const;

/** Consommateur, ou affilié : un affilié pourra aussi vendre dans le Marketplace. */
export function AccountStep({ draft, update }: StepProps) {
  const t = useTranslations("Onboarding.account");

  return (
    <div
      role="radiogroup"
      aria-label={t("title")}
      className="grid gap-3 sm:grid-cols-2"
    >
      {ACCOUNT_TYPES.map((type) => {
        const Icon = ICONS[type];
        const checked = draft.accountType === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => update({ accountType: type })}
            className={cn(
              "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              checked
                ? "border-primary bg-primary/15"
                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
            )}
          >
            <Icon aria-hidden="true" className="size-5 text-primary" />
            <span className="font-heading text-lg font-bold">
              {t(`types.${type}.title`)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t(`types.${type}.description`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
