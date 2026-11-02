import {
  BookOpen,
  ChevronRight,
  Dumbbell,
  ImageIcon,
  Plus,
  Sparkles,
  Utensils,
  Video,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  getLibraryItemForEdit,
  listLibraryAdmin,
} from "@/server/library/service";
import { getCurrentProfile } from "@/server/profile/service";
import { LIBRARY_KINDS, type LibraryKind } from "../rules";
import { ImportSeedButton } from "./library-admin-controls";
import { LibraryItemForm } from "./library-item-form";

const KIND_ICONS = { exercise: Dumbbell, recipe: Utensils, tool: Sparkles };

/**
 * Catalogue de Mon développement pour l'équipe Get iT (rôle admin) : toutes
 * les fiches, brouillons compris, et l'import du contenu de départ. Lit la
 * session : à placer dans un <Suspense>.
 */
export async function LibraryAdminPanel() {
  const profile = await getCurrentProfile();
  const [rows, t] = await Promise.all([
    listLibraryAdmin(profile.id),
    getTranslations("LibraryAdmin"),
  ]);
  if (!rows) notFound();
  const drafts = rows.filter((row) => row.status === "draft").length;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t("summary", { count: rows.length, drafts })}
        </p>
        <ImportSeedButton />
      </section>

      {LIBRARY_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind];
        const items = rows.filter((row) => row.kind === kind);
        return (
          <section
            key={kind}
            aria-labelledby={`library-${kind}`}
            className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id={`library-${kind}`}
                className="flex items-center gap-2 font-heading text-lg font-bold"
              >
                <Icon aria-hidden="true" className="size-5 text-primary" />
                {t(`kinds.${kind}`, { count: items.length })}
              </h2>
              <Button asChild size="sm" variant="outline">
                <Link href={`/settings/library/new?kind=${kind}`}>
                  <Plus aria-hidden="true" />
                  {t(`new.${kind}`)}
                </Link>
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.id} className="border-b border-foreground/8">
                    <Link
                      href={`/settings/library/${item.id}`}
                      className="-mx-3 flex items-center gap-3 rounded-xl px-3 py-3 outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium text-pretty">
                          {item.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {item.kind === "tool"
                            ? t(`pillars.${item.pillar}`)
                            : null}
                          {item.seeded ? <span>{t("seeded")}</span> : null}
                        </span>
                      </span>
                      {item.hasImage ? (
                        <ImageIcon
                          aria-label={t("hasImage")}
                          className="size-4 text-muted-foreground"
                        />
                      ) : null}
                      {item.hasVideo ? (
                        <Video
                          aria-label={t("hasVideo")}
                          className="size-4 text-muted-foreground"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          item.status === "published"
                            ? "bg-primary/14 text-primary"
                            : "bg-foreground/8 text-muted-foreground",
                        )}
                      >
                        {t(`status.${item.status}`)}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Nouvelle fiche d'un type (équipe seulement). */
export async function LibraryNewPanel({ kind }: { kind: string }) {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") notFound();
  const valid = LIBRARY_KINDS.find((value) => value === kind);
  if (!valid) notFound();
  return <LibraryItemForm kind={valid as LibraryKind} initial={null} />;
}

/** Fiche existante à modifier (équipe seulement). */
export async function LibraryEditPanel({ id }: { id: string }) {
  const profile = await getCurrentProfile();
  const item = /^[0-9a-f-]{36}$/.test(id)
    ? await getLibraryItemForEdit(profile.id, id)
    : null;
  if (!item) notFound();
  return <LibraryItemForm kind={item.kind} initial={item} />;
}

/** Lien vers le catalogue, dans Réglages, pour l'équipe Get iT seulement. */
export async function LibraryAdminLink() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") return null;
  const t = await getTranslations("LibraryAdmin");
  return (
    <section className="flex max-w-2xl flex-col gap-2 border-t border-foreground/8 pt-6">
      <h2 className="caps-label text-muted-foreground">{t("settingsTitle")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("settingsDescription")}
      </p>
      <Link
        href="/settings/library"
        className="flex h-10 w-fit items-center gap-2 rounded-full border border-foreground/15 px-4 text-sm font-medium outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BookOpen aria-hidden="true" className="size-4" />
        {t("settingsLink")}
      </Link>
    </section>
  );
}

export function LibraryAdminSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
