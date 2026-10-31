"use client";

import { LoaderCircle, MessageCircle, Search, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { Input } from "@/components/ui/input";
import {
  searchMembersAction,
  startConversationAction,
} from "@/features/messages/actions";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ContactPerson } from "@/server/contacts/service";
import {
  removeContactAction,
  requestContactAction,
  respondContactAction,
} from "../actions";
import type { ContactError } from "../rules";

type ContactsViewProps = {
  contacts: ContactPerson[];
  received: ContactPerson[];
  sent: ContactPerson[];
  /** Contacts en ligne (rond orange). */
  online: string[];
};

type Tab = "contacts" | "received" | "sent";

/** Contacts, demandes reçues et envoyées, et recherche pour en ajouter. */
export function ContactsView({
  contacts,
  received,
  sent,
  online,
}: ContactsViewProps) {
  const t = useTranslations("Contacts");
  const [tab, setTab] = useState<Tab>(
    received.length > 0 ? "received" : "contacts",
  );
  const lists: Record<Tab, ContactPerson[]> = { contacts, received, sent };
  const shown = lists[tab];

  return (
    <div className="flex flex-col gap-6">
      <AddContact
        sent={new Set(sent.map((person) => person.id))}
        received={new Set(received.map((person) => person.id))}
      />

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="grid grid-cols-3 gap-2"
      >
        {(["contacts", "received", "sent"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "truncate rounded-full border px-2 py-1.5 text-center text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === value
                ? "border-primary bg-primary/15 text-foreground"
                : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${value}`, { count: lists[value].length })}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          {t(`empty.${tab}`)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/8">
          {shown.map((person) => (
            <li key={person.id}>
              <ContactRow
                person={person}
                tab={tab}
                online={tab === "contacts" && online.includes(person.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Person({
  person,
  online = false,
  children,
}: {
  person: ContactPerson;
  online?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations("Contacts");
  const name = person.displayName ?? person.username ?? "";
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar
        name={name}
        url={person.avatarUrl}
        online={online}
        className="size-11"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">
          {name}
          {online ? <span className="sr-only"> · {t("online")}</span> : null}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          @{person.username}
          {person.level === null
            ? null
            : ` · ${t("level", { level: person.level })}`}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {children}
      </span>
    </div>
  );
}

function ContactRow({
  person,
  tab,
  online,
}: {
  person: ContactPerson;
  tab: Tab;
  online: boolean;
}) {
  const t = useTranslations("Contacts");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function write() {
    startTransition(async () => {
      const result = await startConversationAction(person.id);
      if (result.ok) router.push(`/messages/${result.id}`);
    });
  }

  return (
    <Person person={person} online={online}>
      {tab === "contacts" ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={write}
          >
            <MessageCircle aria-hidden="true" />
            {t("write")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(
                async () => void (await removeContactAction(person.id)),
              )
            }
            className="text-muted-foreground"
          >
            {t("remove")}
          </Button>
        </>
      ) : tab === "received" ? (
        <>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(
                async () => void (await respondContactAction(person.id, true)),
              )
            }
          >
            {t("accept")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(
                async () => void (await respondContactAction(person.id, false)),
              )
            }
          >
            {t("decline")}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(
              async () => void (await removeContactAction(person.id)),
            )
          }
          className="text-muted-foreground"
        >
          {t("cancel")}
        </Button>
      )}
    </Person>
  );
}

/** Chercher un membre du Centre et lui envoyer une demande de contact. */
function AddContact({
  sent,
  received,
}: {
  sent: Set<string>;
  received: Set<string>;
}) {
  const t = useTranslations("Contacts");
  const tErrors = useTranslations("Contacts.errors");
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    (ContactPerson & { contact: boolean })[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState<ContactError | null>(null);
  const [pending, startTransition] = useTransition();

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

  function add(person: ContactPerson) {
    setError(null);
    startTransition(async () => {
      const result = await requestContactAction(person.id);
      if (!result.ok) setError(result.error);
      else if (result.state === "sent") {
        setSentTo((current) => new Set([...current, person.id]));
      } else {
        // Demande reçue acceptée : la personne devient un contact
        setResults(
          (current) =>
            current?.map((item) =>
              item.id === person.id ? { ...item, contact: true } : item,
            ) ?? null,
        );
      }
    });
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="font-heading font-bold">
        {t("addTitle")}
      </h2>
      <div className="relative">
        <label htmlFor={`${id}-search`} className="sr-only">
          {t("searchLabel")}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearching(event.target.value.trim() !== "");
            if (!event.target.value.trim()) setResults(null);
          }}
          placeholder={t("searchPlaceholder")}
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
        ) : results?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noResult")}</p>
        ) : results ? (
          <ul className="flex flex-col">
            {results.map((person) => (
              <li key={person.id}>
                <Person person={person}>
                  {person.contact ? (
                    <span className="rounded-full bg-foreground/6 px-2.5 py-1 text-xs text-muted-foreground">
                      {t("alreadyContact")}
                    </span>
                  ) : sent.has(person.id) || sentTo.has(person.id) ? (
                    <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs text-primary">
                      {t("requested")}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => add(person)}
                    >
                      <UserPlus aria-hidden="true" />
                      {received.has(person.id) ? t("accept") : t("add")}
                    </Button>
                  )}
                </Person>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
