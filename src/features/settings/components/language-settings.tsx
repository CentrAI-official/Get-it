"use client";

import { hasLocale, useLocale, useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { routing } from "@/i18n/routing";
import { useSwitchLocale } from "@/i18n/use-switch-locale";

// Le choix est aussi enregistré dans UserSettings.locale (voir useSwitchLocale)
export function LanguageSettings({ labelledBy }: { labelledBy: string }) {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const { switchLocale, isPending } = useSwitchLocale();

  return (
    <RadioGroup
      value={locale}
      disabled={isPending}
      aria-labelledby={labelledBy}
      onValueChange={(value) => {
        if (hasLocale(routing.locales, value)) switchLocale(value);
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      {routing.locales.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background/40 p-4 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
        >
          <RadioGroupItem value={option} />
          <span lang={option} className="font-medium">
            {t("locale", { locale: option })}
          </span>
          <span className="ml-auto text-xs text-muted-foreground uppercase">
            {option}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
