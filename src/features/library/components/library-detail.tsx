import {
  CircleAlert,
  Clock,
  Dumbbell,
  LifeBuoy,
  Pencil,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { planHref } from "@/features/development/questionnaires";
import { getPlanTarget } from "@/server/development/library";
import { getLibraryItem } from "@/server/library/service";
import { getCurrentProfile } from "@/server/profile/service";
import { libraryListPath } from "../paths";
import { LibraryVideo } from "./library-video";
import { PlanActions } from "./plan-actions";
import { YoutubeEmbed } from "./youtube-embed";

const KIND_ICONS = { exercise: Dumbbell, recipe: Utensils, tool: Sparkles };

/** Valeurs d'une famille d'étiquettes (« muscle:chest » → « chest »). */
const valuesOf = (tags: readonly string[], group: string) =>
  tags
    .filter((tag) => tag.startsWith(`${group}:`))
    .map((tag) => tag.slice(group.length + 1));

/**
 * Fiche d'un exercice, d'une recette ou d'un outil : vidéo ou photo,
 * description, étapes et ce qui est propre à son type. Lit la session : à
 * placer dans un <Suspense>.
 */
export async function LibraryDetail({ id }: { id: string }) {
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  const [item, t] = await Promise.all([
    getLibraryItem(profile.id, id, locale),
    getTranslations("Library"),
  ]);
  if (!item) notFound();
  const target = await getPlanTarget(profile.id, item);
  const Icon = KIND_ICONS[item.kind];
  const label = (group: string, value: string) =>
    t(`values.${group}.${value}` as "values.muscle.chest");
  // Étiquettes montrées en pastilles, selon le type
  const groups =
    item.kind === "exercise"
      ? ["muscle", "place", "equipment", "level"]
      : item.kind === "recipe"
        ? ["meal", "goal", "diet"]
        : ["theme"];
  const allergens = valuesOf(item.tags, "allergen");
  const section = (title: string, lines: string[], ordered = false) =>
    lines.length > 0 ? (
      <section className="flex flex-col gap-3 border-t border-foreground/8 pt-6">
        <h2 className="caps-label text-muted-foreground">{title}</h2>
        {ordered ? (
          <ol className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/14 text-xs font-bold text-primary tabular-nums">
                  {index + 1}
                </span>
                <span className="text-pretty">{line}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
            {lines.map((line, index) => (
              <li key={index} className="text-pretty">
                {line}
              </li>
            ))}
          </ul>
        )}
      </section>
    ) : null;

  return (
    <article className="flex flex-col gap-6">
      <BackLink
        href={libraryListPath(item.kind, item.pillar)}
        label={t(`back.${item.kind}`)}
      />
      {item.status === "draft" ? (
        <p className="flex items-start gap-2 rounded-2xl bg-foreground/[0.06] p-3 text-sm">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <span className="flex flex-col gap-1">
            {t("detail.draftNotice")}
            <Link
              href={`/settings/library/${item.id}`}
              className="flex w-fit items-center gap-1 font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              {t("detail.edit")}
            </Link>
          </span>
        </p>
      ) : null}

      {item.videoUrl ? (
        <LibraryVideo
          src={item.videoUrl}
          poster={item.imageUrl}
          label={t("detail.videoLabel", { title: item.title })}
        />
      ) : item.youtube ? (
        <YoutubeEmbed
          video={item.youtube}
          channel={item.youtube.channel}
          poster={item.imageUrl}
          title={item.title}
        />
      ) : item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="aspect-video w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-foreground/[0.06] text-sm text-muted-foreground">
          <Icon aria-hidden="true" className="size-8" />
          {item.kind === "exercise" ? t("detail.videoSoon") : null}
        </div>
      )}

      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl leading-tight font-bold text-balance">
          {item.title}
        </h1>
        <p className="text-pretty text-muted-foreground">{item.summary}</p>
        <div className="flex flex-wrap gap-2">
          {item.minutes ? (
            <span className="flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium tabular-nums">
              <Clock aria-hidden="true" className="size-3.5" />
              {t(item.kind === "recipe" ? "detail.prep" : "detail.duration", {
                count: item.minutes,
              })}
            </span>
          ) : null}
          {item.servings ? (
            <span className="flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium tabular-nums">
              <Users aria-hidden="true" className="size-3.5" />
              {t("detail.servings", { count: item.servings })}
            </span>
          ) : null}
          {groups.flatMap((group) =>
            valuesOf(item.tags, group).map((value) => (
              <span
                key={`${group}:${value}`}
                className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium"
              >
                {label(group, value)}
              </span>
            )),
          )}
        </div>
      </header>

      <PlanActions
        itemId={item.id}
        kind={item.kind}
        target={target}
        planHref={planHref(target.planKind)}
      />

      {item.description ? (
        <p className="text-pretty whitespace-pre-line">{item.description}</p>
      ) : null}

      {item.kind === "recipe" ? (
        // Allergènes : ce que la recette contient, et toujours vérifier les étiquettes
        <section className="flex flex-col gap-2 rounded-2xl bg-primary/[0.07] p-4 text-sm">
          <p className="font-semibold">
            {allergens.length > 0
              ? t("detail.contains", {
                  list: allergens
                    .map((value) => label("allergen", value))
                    .join(", "),
                })
              : t("detail.noAllergen")}
          </p>
          <p className="text-muted-foreground">{t("detail.labelWarning")}</p>
        </section>
      ) : null}

      {section(t("detail.ingredients"), item.ingredients)}
      {section(t(`detail.steps.${item.kind}`), item.steps, true)}
      {section(t("detail.cues"), item.cues)}
      {section(t("detail.mistakes"), item.mistakes)}

      {item.kind === "tool" && item.pillar === "mental" ? (
        <p className="flex items-start gap-2 border-t border-foreground/8 pt-6 text-sm text-muted-foreground">
          <LifeBuoy
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          {t("detail.crisis")}
        </p>
      ) : null}
      {item.kind === "exercise" ? (
        <p className="border-t border-foreground/8 pt-6 text-xs text-muted-foreground">
          {t("detail.safety")}
        </p>
      ) : null}
    </article>
  );
}

export function LibraryDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-full" />
    </div>
  );
}
