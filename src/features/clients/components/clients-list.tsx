"use client";

import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PageClientItem } from "@/server/clients/service";
import {
  CLIENT_SORTS,
  lastActiveLabel,
  matchesClient,
  sortClients,
  type ClientSort,
} from "../activity";
import { CLIENT_LIMITS, SHAREABLE_KINDS, type ShareableKind } from "../rules";
import { CancelInvitationButton, RequestAnswerButtons } from "./client-forms";

// La liste des clients d'une page pro (décision du fondateur, 2026-11-10 :
// la maquette « Liste pro ») : chercher, les onglets par statut, le plan et le
// tri, puis une ligne par personne.

export const CLIENT_TABS = ["active", "requests", "invited", "former"] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

const STATUS_OF: Record<ClientTab, PageClientItem["status"]> = {
  active: "active",
  requests: "requested",
  invited: "invited",
  former: "ended",
};

const nameOf = (item: PageClientItem) =>
  item.client.displayName ?? item.client.username ?? "";

function PersonLine({
  item,
  detail,
}: {
  item: PageClientItem;
  detail: string;
}) {
  const name = nameOf(item);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={name} url={item.client.avatarUrl} className="size-10" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </span>
  );
}

/** Un filtre en pastille : « Plan : tous », « Trier : activité récente ». */
function FilterMenu<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 min-w-0 items-center gap-1.5 rounded-full border border-foreground/15 px-3.5 text-sm font-medium outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="truncate">{label}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as Value)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="min-h-10"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ClientsList({
  items,
  loadedAt,
  initialTab,
}: {
  items: PageClientItem[];
  loadedAt: number;
  initialTab: ClientTab;
}) {
  const t = useTranslations("Clients");
  const tList = useTranslations("Clients.list");
  const format = useFormatter();
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tab, setTab] = useState<ClientTab>(initialTab);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ShareableKind | "all">("all");
  const [sort, setSort] = useState<ClientSort>("recent");

  const date = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "long" });
  const kindsText = (kinds: readonly ShareableKind[]) =>
    kinds.length === 0
      ? tList("noShares")
      : format.list(
          kinds.map((value) => tList(`kinds.${value}`)),
          { type: "unit" },
        );
  const count = (value: ClientTab) =>
    items.filter((item) => item.status === STATUS_OF[value]).length;
  const open = items.filter((item) => item.status !== "ended").length;
  const sharedKinds = SHAREABLE_KINDS.filter((value) =>
    items.some(
      (item) => item.status === "active" && item.sharedKinds.includes(value),
    ),
  );

  const shown = items.filter(
    (item) =>
      item.status === STATUS_OF[tab] &&
      matchesClient(item.client, query) &&
      (tab !== "active" || kind === "all" || item.sharedKinds.includes(kind)),
  );
  const rows =
    tab === "active"
      ? sortClients(
          shown.map((item) => ({
            item,
            name: nameOf(item),
            lastActiveAt: item.activity?.lastActiveAt ?? null,
            flag: item.activity?.flag ?? null,
            percent: item.activity?.summary.percent ?? null,
          })),
          sort,
        ).map((row) => row.item)
      : shown;

  function last(item: PageClientItem) {
    const label = lastActiveLabel(
      item.activity?.lastActiveAt ?? null,
      loadedAt,
    );
    return tList(`last.${label.key}`, { count: label.count });
  }

  function moveTab(event: React.KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + CLIENT_TABS.length) % CLIENT_TABS.length;
    const value = CLIENT_TABS[next];
    if (!value) return;
    setTab(value);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor={`${id}-search`} className="sr-only">
          {tList("search")}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tList("search")}
          autoComplete="off"
          className="h-11 w-full rounded-full border border-foreground/15 bg-raised pr-4 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div
        role="tablist"
        aria-label={tList("tabsLabel")}
        className="flex [scrollbar-width:none] gap-5 overflow-x-auto border-b border-foreground/8"
      >
        {CLIENT_TABS.map((value, index) => {
          const selected = tab === value;
          const total = count(value);
          return (
            <button
              key={value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => moveTab(event, index)}
              className={cn(
                "-mb-px flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {tList(`tabs.${value}`)}
              {value === "requests" && total > 0 ? (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground tabular-nums">
                  {total}
                </span>
              ) : total > 0 ? (
                <span className="font-medium text-muted-foreground tabular-nums">
                  {total}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "active" && count("active") > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterMenu
            label={tList("plan", {
              plan: kind === "all" ? tList("allPlans") : tList(`kinds.${kind}`),
            })}
            value={kind}
            options={[
              { value: "all" as const, label: tList("allPlans") },
              ...sharedKinds.map((value) => ({
                value,
                label: tList(`kinds.${value}`),
              })),
            ]}
            onChange={setKind}
          />
          <FilterMenu
            label={tList("sort", { sort: tList(`sorts.${sort}`) })}
            value={sort}
            options={CLIENT_SORTS.map((value) => ({
              value,
              label: tList(`sorts.${value}`),
            }))}
            onChange={setSort}
          />
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
      >
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {query.trim() || kind !== "all"
              ? tList("noMatch")
              : tList(`empty.${tab}`)}
          </p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((item) => {
              if (item.status === "active") {
                const summary = item.activity?.summary;
                const flag = item.activity?.flag ?? null;
                return (
                  <li key={item.id} className="border-b border-foreground/8">
                    <Link
                      href={`/clients/${item.client.id}`}
                      className="flex min-h-[68px] items-center gap-3 py-2 outline-none hover:bg-foreground/[0.03] focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Avatar
                        name={nameOf(item)}
                        url={item.client.avatarUrl}
                        className="size-10"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate font-semibold">
                          {nameOf(item)}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {flag ? (
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {tList(`flags.${flag}`)}
                            </span>
                          ) : null}
                          <span className="truncate">
                            {kindsText(item.sharedKinds)}
                            {summary && summary.plannedDays > 0
                              ? ` · ${tList("days", {
                                  done: summary.fullDays,
                                  planned: summary.plannedDays,
                                })}`
                              : null}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {last(item)}
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </span>
                    </Link>
                  </li>
                );
              }
              if (item.status === "requested") {
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 border-b border-foreground/8 py-4"
                  >
                    <PersonLine
                      item={item}
                      detail={t("home.requested", { date: date(item.since) })}
                    />
                    {item.message ? (
                      <p className="text-sm break-words whitespace-pre-line">
                        {t("home.message", { message: item.message })}
                      </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {tList("asks", { plans: kindsText(item.sharedKinds) })}
                    </p>
                    <RequestAnswerButtons relationId={item.id} />
                  </li>
                );
              }
              if (item.status === "invited") {
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/8 py-3"
                  >
                    <PersonLine
                      item={item}
                      detail={t("home.invitedOn", { date: date(item.since) })}
                    />
                    <CancelInvitationButton relationId={item.id} />
                  </li>
                );
              }
              return (
                <li key={item.id} className="border-b border-foreground/8">
                  <Link
                    href={`/clients/${item.client.id}`}
                    className="flex min-h-14 items-center gap-3 py-2 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <PersonLine
                      item={item}
                      detail={t("home.endedOn", {
                        date: date(item.endedAt ?? item.since),
                      })}
                    />
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground tabular-nums">
        {tList("open", { count: open, max: CLIENT_LIMITS.openPerPage })}
      </p>
    </div>
  );
}
