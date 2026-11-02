import {
  Clock,
  Dumbbell,
  Search,
  Sparkles,
  Utensils,
  Video,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getPathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listLibrary, type LibraryCard } from "@/server/library/service";
import { getCurrentProfile } from "@/server/profile/service";
import { libraryItemPath } from "../paths";
import {
  ALLERGENS,
  FILTER_GROUPS,
  parseFilters,
  TOOL_THEMES,
  type LibraryKind,
  type LibraryPillar,
  type ToolPillar,
} from "../rules";

type SearchParams = Record<string, string | string[] | undefined>;

const chip =
  "flex h-8 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground";

const KIND_ICONS = { exercise: Dumbbell, recipe: Utensils, tool: Sparkles };

/** Adresse de la liste avec une valeur ajoutée ou retirée d'une famille de filtres. */
function toggled(
  basePath: string,
  params: SearchParams,
  keys: readonly string[],
  key: string,
  value: string,
) {
  const query = new URLSearchParams();
  for (const name of [...keys, "q"]) {
    const current = params[name];
    const text = Array.isArray(current) ? current.join(",") : current;
    if (text) query.set(name, text);
  }
  const values = new Set((query.get(key) ?? "").split(",").filter(Boolean));
  if (values.has(value)) values.delete(value);
  else values.add(value);
  if (values.size > 0) query.set(key, [...values].join(","));
  else query.delete(key);
  const text = query.toString();
  return `${basePath}${text ? `?${text}` : ""}`;
}

/**
 * Bibliothèque d'un type (exercices, recettes ou outils d'un pilier) :
 * recherche, filtres en pastilles (dans l'adresse) et fiches. Lit la session :
 * à placer dans un <Suspense>.
 */
export async function LibraryBrowser({
  kind,
  pillar,
  basePath,
  searchParams,
}: {
  kind: LibraryKind;
  pillar: LibraryPillar;
  basePath: `/${string}`;
  searchParams: Promise<SearchParams>;
}) {
  const profile = await getCurrentProfile();
  const [params, locale, t] = await Promise.all([
    searchParams,
    getLocale(),
    getTranslations("Library"),
  ]);
  const toolPillar = kind === "tool" ? (pillar as ToolPillar) : undefined;
  const filters = parseFilters(kind, params, toolPillar);
  const items = await listLibrary(profile.id, {
    kind,
    pillar,
    filters,
    locale,
  });
  // Familles de filtres de l'écran ; « sans » exclut les allergènes des recettes
  const groups: [string, readonly string[]][] =
    kind === "tool"
      ? [["theme", TOOL_THEMES[toolPillar ?? "mental"]]]
      : kind === "recipe"
        ? [
            ["meal", FILTER_GROUPS.recipe.meal],
            ["goal", FILTER_GROUPS.recipe.goal],
            ["diet", FILTER_GROUPS.recipe.diet],
            ["sans", ALLERGENS],
          ]
        : Object.entries(FILTER_GROUPS.exercise);
  const keys = groups.map(([key]) => key);
  const chosen = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value.join(",") : (value ?? ""))
      .split(",")
      .filter(Boolean);
  };
  const active =
    keys.some((key) => chosen(key).length > 0) || filters.q.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Recherche envoyée dans l'adresse (GET), avec les filtres choisis */}
      <form
        action={getPathname({ href: basePath, locale })}
        className="flex gap-2"
        role="search"
      >
        {keys.map((key) =>
          chosen(key).length > 0 ? (
            <input
              key={key}
              type="hidden"
              name={key}
              value={chosen(key).join(",")}
            />
          ) : null,
        )}
        <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder={t(`search.${kind}`)}
          aria-label={t(`search.${kind}`)}
          className="h-10"
        />
        <Button type="submit" variant="outline" size="icon" className="size-10">
          <Search aria-hidden="true" />
          <span className="sr-only">{t("search.submit")}</span>
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        {groups.map(([key, values]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="caps-label text-muted-foreground">
              {t(`filters.${key}` as "filters.muscle")}
            </span>
            <div className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
              {values.map((value) => {
                const on = chosen(key).includes(value);
                const family = key === "sans" ? "allergen" : key;
                return (
                  <Link
                    key={value}
                    href={toggled(basePath, params, keys, key, value)}
                    aria-pressed={on}
                    scroll={false}
                    className={cn(chip, on ? chipOn : chipOff)}
                  >
                    {key === "sans"
                      ? t("filters.without", {
                          allergen: t(
                            `values.allergen.${value}` as "values.allergen.milk",
                          ),
                        })
                      : t(`values.${family}.${value}` as "values.muscle.chest")}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-foreground/8 pt-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("count", { count: items.length })}
        </p>
        {active ? (
          <Link
            href={basePath}
            scroll={false}
            className="text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("filters.clear")}
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={KIND_ICONS[kind]}
          title={active ? t("empty.filtered") : t("empty.title")}
          description={
            active ? t("empty.filteredDescription") : t("empty.description")
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <LibraryCardView item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function LibraryCardView({ item }: { item: LibraryCard }) {
  const t = await getTranslations("Library");
  const Icon = KIND_ICONS[item.kind];
  return (
    <Link
      href={libraryItemPath(item.id)}
      className="group flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.06]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <Icon aria-hidden="true" className="size-8 text-muted-foreground" />
        )}
        {item.hasVideo ? (
          <span className="dark absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-foreground">
            <Video aria-hidden="true" className="size-3" />
            {t("video")}
          </span>
        ) : null}
        {item.status === "draft" ? (
          <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold">
            {t("draft")}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="leading-snug font-semibold text-pretty">
          {item.title}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {item.summary}
        </span>
        {item.minutes ? (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Clock aria-hidden="true" className="size-3" />
            {t("minutes", { count: item.minutes })}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
