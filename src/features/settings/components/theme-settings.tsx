"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isThemePreference, type ThemePreference } from "@/config/theme";
import { saveThemePreferenceAction } from "../actions";
import { applyThemePreference } from "../theme-client";

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

// Le choix s'applique tout de suite (cookie) et est enregistré dans le compte
export function ThemeSettings({
  labelledBy,
  initial,
}: {
  labelledBy: string;
  /** Thème enregistré dans le compte. */
  initial: ThemePreference;
}) {
  const t = useTranslations("App.settings.theme");
  const [theme, setTheme] = useState(initial);

  return (
    <RadioGroup
      value={theme}
      aria-labelledby={labelledBy}
      onValueChange={(value) => {
        if (!isThemePreference(value)) return;
        setTheme(value);
        applyThemePreference(value);
        void saveThemePreferenceAction(value);
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      {(["system", "light", "dark"] as const).map((option) => {
        const Icon = ICONS[option];
        return (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 transition-colors hover:bg-foreground/[0.06] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10"
          >
            <RadioGroupItem value={option} />
            <span className="font-medium">{t(option)}</span>
            <Icon
              aria-hidden="true"
              className="ml-auto size-4 text-muted-foreground"
            />
          </label>
        );
      })}
    </RadioGroup>
  );
}
