"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { SEARCH_MAX_LENGTH } from "../rules";

/** « Que veux-tu accomplir? » : recherche dans les titres et les résumés. */
export function VitrineSearch({
  base,
  defaultValue,
}: {
  /** Page de l'onglet (services ou gear). */
  base: "/marketplace" | "/marketplace/gear";
  defaultValue: string;
}) {
  const t = useTranslations("Marketplace.vitrine");
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();

  function go(query: string) {
    const q = query.trim();
    startTransition(() => {
      router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
    });
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        go(value);
      }}
      className="flex h-14 items-center gap-3 rounded-full border border-white/12 bg-white/[0.04] pr-2 pl-5 shadow-[0_8px_24px_rgb(0_0_0/0.35)] focus-within:ring-3 focus-within:ring-ring/50"
    >
      <Search aria-hidden="true" className="size-5 shrink-0 text-foreground" />
      <label htmlFor={`${id}-q`} className="sr-only">
        {t("searchLabel")}
      </label>
      <input
        id={`${id}-q`}
        type="search"
        enterKeyHint="search"
        value={value}
        maxLength={SEARCH_MAX_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-full min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label={t("clear")}
          onClick={() => {
            setValue("");
            if (defaultValue) go("");
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      ) : null}
    </form>
  );
}
