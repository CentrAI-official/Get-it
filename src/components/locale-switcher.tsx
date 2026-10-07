"use client";

import { Languages } from "lucide-react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routing } from "@/i18n/routing";
import { useSwitchLocale } from "@/i18n/use-switch-locale";

/** Menu compact de changement de langue (en-têtes, barre latérale). */
export function LocaleSwitcher({ align = "end" }: { align?: "start" | "end" }) {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const { switchLocale, isPending } = useSwitchLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`${t("change")} (${t("locale", { locale })})`}
        >
          <Languages aria-hidden="true" />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-40">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            if (hasLocale(routing.locales, value)) switchLocale(value);
          }}
        >
          {routing.locales.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} lang={option}>
              {t("locale", { locale: option })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
