"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { MessagePerson } from "@/server/messages/service";
import { searchMembersAction, startConversationAction } from "../actions";
import type { MessageError } from "../rules";

/** Chercher un membre du Centre et ouvrir la conversation. */
export function NewMessage() {
  const t = useTranslations("Messages.search");
  const tErrors = useTranslations("Messages.errors");
  const tInbox = useTranslations("Messages.inbox");
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    (MessagePerson & { contact: boolean })[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<MessageError | null>(null);
  const [pending, startTransition] = useTransition();

  // Recherche une fois la saisie arrêtée (300 ms)
  useEffect(() => {
    const value = query.trim();
    if (!value) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const found = await searchMembersAction(value).catch(() => []);
      if (!active) return;
      setResults(found);
      setSearching(false);
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  function open(person: MessagePerson) {
    setError(null);
    startTransition(async () => {
      const result = await startConversationAction(person.id);
      if (result.ok) router.push(`/messages/${result.id}`);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor={`${id}-search`} className="sr-only">
          {t("label")}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={`${id}-search`}
          type="search"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearching(event.target.value.trim() !== "");
            if (!event.target.value.trim()) setResults(null);
          }}
          placeholder={t("placeholder")}
          className="h-11 rounded-full pl-10"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}

      <div aria-live="polite">
        {searching ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {t("searching")}
          </p>
        ) : results === null ? (
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {results.map((person) => {
              const name = person.displayName ?? person.username ?? "";
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => open(person)}
                    className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors outline-none hover:bg-white/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full orb font-heading font-bold uppercase"
                    >
                      {name.charAt(0)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{name}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        @{person.username} ·{" "}
                        {tInbox("level", { level: person.level })}
                      </span>
                    </span>
                    {person.contact ? (
                      <span className="shrink-0 rounded-full bg-white/6 px-2.5 py-1 text-xs text-muted-foreground">
                        {t("contact")}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
