import { Music } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getCurrentProfile } from "@/server/profile/service";
import { storageEnabled } from "@/server/storage/service";
import { listCatalog } from "@/server/stories/music";
import { MusicUploadForm, TrackToggle } from "./music-upload-form";

const duration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Catalogue de musique des stories : réservé à l'équipe Get iT (introuvable sinon). */
export async function MusicCatalogPanel() {
  const profile = await getCurrentProfile();
  const [tracks, t, format] = await Promise.all([
    listCatalog(profile.id),
    getTranslations("MusicCatalog"),
    getFormatter(),
  ]);
  if (tracks === null) notFound();

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="caps-label text-muted-foreground">{t("addTitle")}</h2>
        {storageEnabled() ? (
          <MusicUploadForm />
        ) : (
          <p className="text-sm text-muted-foreground">{t("storageOff")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-foreground/8 pt-6">
        <h2 className="caps-label text-muted-foreground">
          {t("catalogTitle", { count: tracks.length })}
        </h2>
        {tracks.length === 0 ? (
          <EmptyState
            icon={Music}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col">
            {tracks.map((track) => (
              <li
                key={track.id}
                className="flex items-start gap-3 border-b border-foreground/8 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="font-semibold break-words">
                    {track.title}
                    {track.active ? null : (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {t("removed")}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("meta", {
                      artist: track.artist,
                      duration: duration(track.durationMs),
                      uses: track.uses,
                    })}
                  </p>
                  {track.moods.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {format.list(track.moods)}
                    </p>
                  ) : null}
                  <p className="text-xs break-words text-muted-foreground">
                    {t("license", { license: track.license })}
                  </p>
                </div>
                <TrackToggle
                  trackId={track.id}
                  active={track.active}
                  title={track.title}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function MusicCatalogSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  );
}

/** Lien vers le catalogue, dans Réglages, pour l'équipe Get iT seulement. */
export async function MusicCatalogLink() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") return null;
  const t = await getTranslations("MusicCatalog");
  return (
    <section className="flex max-w-2xl flex-col gap-2 border-t border-foreground/8 pt-6">
      <h2 className="caps-label text-muted-foreground">{t("settingsTitle")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("settingsDescription")}
      </p>
      <Link
        href="/settings/music"
        className="flex h-10 w-fit items-center gap-2 rounded-full border border-foreground/15 px-4 text-sm font-medium outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Music aria-hidden="true" className="size-4" />
        {t("settingsLink")}
      </Link>
    </section>
  );
}
