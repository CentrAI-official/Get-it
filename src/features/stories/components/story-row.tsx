"use client";

import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Flag,
  ImagePlus,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ReportDialog } from "@/features/community/components/report-dialog";
import type { CommunityError } from "@/features/community/rules";
import { useMediaUploads } from "@/features/community/use-media-uploads";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { StoryRing } from "@/server/stories/service";
import { createStoryAction, deleteStoryAction } from "../actions";
import {
  firstUnseenIndex,
  hasUnseen,
  orderRings,
  STORY_CAPTION_MAX,
  STORY_IMAGE_MS,
  STORY_TTL_MS,
} from "../rules";
import { markStorySeen, useSeenStories } from "../seen-store";

const BUBBLE =
  "flex w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
// Stories en carré arrondi (maquette « Bento », décision du fondateur, 2026-10-29)
const RING = "flex size-16 rounded-[22px] p-[3px]";
const INNER = "flex size-full rounded-[19px] bg-background p-[2px]";
const FACE = "size-full rounded-[17px] text-lg";

/** Une personne et l'une de ses stories, ouvertes dans la visionneuse. */
type Opened = { ring: number; story: number };

type StoryRowProps = {
  mine: StoryRing | null;
  contacts: StoryRing[];
  /** Mon nom et ma photo, dans la bulle « Ta story ». */
  name: string;
  avatarUrl: string | null;
  /** Peut publier (membre du Centre, pas suspendu) et le stockage est activé. */
  canPost: boolean;
  /** Heure du serveur au rendu (« il y a 2 h »). */
  now: number;
};

/**
 * Stories du Centre : ma story en premier, puis celles de mes contacts (24 heures).
 * Anneau orange : pas encore vue sur cet appareil.
 */
export function StoryRow({
  mine,
  contacts,
  name,
  avatarUrl,
  canPost,
  now,
}: StoryRowProps) {
  const t = useTranslations("Community.stories");
  const seen = useSeenStories();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Ordre figé pendant la lecture : un anneau vu ne change pas de place sous le doigt
  const [frozen, setFrozen] = useState<StoryRing[] | null>(null);
  const ordered = frozen ?? orderRings(contacts, seen);
  const rings = mine ? [mine, ...ordered] : ordered;

  function open(ring: number) {
    const target = rings[ring];
    if (!target) return;
    setFrozen(ordered);
    setNotice(null);
    setOpened({ ring, story: firstUnseenIndex(target, seen) });
  }

  function close(message?: string) {
    setOpened(null);
    setFrozen(null);
    if (message) setNotice(message);
  }

  return (
    <section aria-label={t("label")} className="-mx-4 sm:mx-0">
      <ul className="flex [scrollbar-width:none] gap-3 overflow-x-auto px-4 pt-1 pb-2 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <li className="relative shrink-0">
          <button
            type="button"
            onClick={() => (mine ? open(0) : canPost && setComposing(true))}
            disabled={!mine && !canPost}
            aria-label={mine ? t("openMine") : t("add")}
            className={BUBBLE}
          >
            <span
              className={cn(
                RING,
                mine && hasUnseen(mine, seen)
                  ? "bg-primary"
                  : mine
                    ? "bg-foreground/15"
                    : "",
              )}
            >
              <span className={INNER}>
                <Avatar name={name} url={avatarUrl} className={FACE} />
              </span>
            </span>
            <span className="max-w-full truncate text-xs font-semibold">
              {t("mine")}
            </span>
          </button>
          {canPost ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              aria-label={t("add")}
              className="absolute top-12 right-1 flex size-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Plus aria-hidden="true" className="size-3.5" strokeWidth={3} />
            </button>
          ) : null}
        </li>

        {ordered.map((ring) => {
          const unseen = hasUnseen(ring, seen);
          const who = ring.author.displayName ?? ring.author.username ?? "";
          const index = rings.indexOf(ring);
          return (
            <li key={ring.author.id} className="shrink-0">
              <button
                type="button"
                onClick={() => open(index)}
                aria-label={
                  unseen
                    ? t("openNew", { name: who })
                    : t("open", { name: who })
                }
                className={BUBBLE}
              >
                <span
                  className={cn(
                    RING,
                    "transition-colors duration-300",
                    unseen ? "bg-primary" : "bg-foreground/15",
                  )}
                >
                  <span className={INNER}>
                    <Avatar
                      name={who}
                      url={ring.author.avatarUrl}
                      className={FACE}
                    />
                  </span>
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-xs",
                    unseen
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {who}
                </span>
              </button>
            </li>
          );
        })}

        {contacts.length === 0 ? (
          // Sans stories de contacts : un chemin pour en ajouter
          <li className="shrink-0">
            <Link
              href="/messages/contacts"
              aria-label={t("addContactsLabel")}
              className={BUBBLE}
            >
              <span className="flex size-16 items-center justify-center rounded-[22px] border-2 border-dashed border-foreground/20 text-muted-foreground">
                <UserPlus aria-hidden="true" className="size-6" />
              </span>
              <span className="max-w-full truncate text-xs text-muted-foreground">
                {t("addContacts")}
              </span>
            </Link>
          </li>
        ) : null}
      </ul>

      {notice ? (
        <p role="status" className="px-4 text-sm text-muted-foreground sm:px-0">
          {notice}
        </p>
      ) : null}

      <StoryViewer
        rings={rings}
        mineId={mine?.author.id ?? null}
        opened={opened}
        onChange={setOpened}
        onClose={close}
        now={now}
      />
      <StoryComposer
        open={composing}
        onOpenChange={setComposing}
        onPosted={() => setComposing(false)}
      />
    </section>
  );
}

type StoryViewerProps = {
  rings: StoryRing[];
  mineId: string | null;
  opened: Opened | null;
  onChange: (opened: Opened) => void;
  onClose: (notice?: string) => void;
  now: number;
};

/** Visionneuse plein écran : une story à la fois, la suivante après 5 s (photo) ou à la fin (vidéo). */
function StoryViewer({
  rings,
  mineId,
  opened,
  onChange,
  onClose,
  now,
}: StoryViewerProps) {
  const t = useTranslations("Community.stories");
  const seen = useSeenStories();
  const ring = opened ? rings[opened.ring] : undefined;
  const story = opened && ring ? ring.stories[opened.story] : undefined;
  const [report, setReport] = useState<string | null>(null);

  function next() {
    if (!opened || !ring) return;
    if (opened.story < ring.stories.length - 1) {
      onChange({ ring: opened.ring, story: opened.story + 1 });
      return;
    }
    const following = rings[opened.ring + 1];
    if (following) {
      onChange({
        ring: opened.ring + 1,
        story: firstUnseenIndex(following, seen),
      });
    } else onClose();
  }

  function previous() {
    if (!opened) return;
    if (opened.story > 0) {
      onChange({ ring: opened.ring, story: opened.story - 1 });
    } else if (opened.ring > 0) {
      const before = rings[opened.ring - 1];
      onChange({
        ring: opened.ring - 1,
        story: (before?.stories.length ?? 1) - 1,
      });
    }
  }

  return (
    <>
      <Dialog
        open={story !== undefined}
        onOpenChange={(value) => !value && onClose()}
      >
        <DialogContent
          closeLabel={t("close")}
          // Plein écran sur téléphone, fenêtre haute sur ordinateur ; toujours sombre
          className="dark inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none bg-black p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(52rem,calc(100dvh-4rem))] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1"
        >
          {ring && story && opened ? (
            // Une story à la fois : son état (avancement, pause) repart de zéro
            <StoryStage
              key={story.id}
              ring={ring}
              index={opened.story}
              mine={ring.author.id === mineId}
              held={report !== null}
              now={now}
              onNext={next}
              onPrevious={previous}
              onReport={() => setReport(story.id)}
              onDeleted={() => onClose(t("deleted"))}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <ReportDialog
        target={report ? { type: "story", id: report } : null}
        onClose={() => setReport(null)}
        onReported={() => {
          setReport(null);
          onClose(t("reported"));
        }}
      />
    </>
  );
}

type StoryStageProps = {
  ring: StoryRing;
  index: number;
  mine: boolean;
  /** Signalement ouvert : la story attend. */
  held: boolean;
  now: number;
  onNext: () => void;
  onPrevious: () => void;
  onReport: () => void;
  onDeleted: () => void;
};

/** Une story : barres d'avancement, auteur, média et légende. */
function StoryStage({
  ring,
  index,
  mine,
  held,
  now,
  onNext,
  onPrevious,
  onReport,
  onDeleted,
}: StoryStageProps) {
  const t = useTranslations("Community.stories");
  const tErrors = useTranslations("Community.errors");
  const format = useFormatter();
  // ring.stories[index] existe : la visionneuse ne rend StoryStage qu'avec une story
  const story = ring.stories[index]!;
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<CommunityError | null>(null);
  const [deleting, startDelete] = useTransition();
  const hold = paused || menuOpen || held;
  const advance = useEffectEvent(() => onNext());

  // Une story affichée est vue (sur cet appareil seulement)
  useEffect(() => {
    markStorySeen(story.id);
  }, [story.id]);

  // Photo : la barre avance pendant 5 s, puis la story suivante
  useEffect(() => {
    if (story.kind !== "image" || hold) return;
    let frame = 0;
    let last = performance.now();
    // Reprend là où la pause l'a arrêtée
    const tick = (time: number) => {
      elapsed.current = Math.min(
        1,
        elapsed.current + (time - last) / STORY_IMAGE_MS,
      );
      last = time;
      setProgress(elapsed.current);
      if (elapsed.current >= 1) advance();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [story.kind, hold]);

  // Vidéo : lecture et pause suivent l'état de la visionneuse
  useEffect(() => {
    const video = videoRef.current;
    if (!video || story.kind !== "video") return;
    if (hold) {
      video.pause();
      return;
    }
    video.play().catch(() => {
      // Son refusé sans geste : la lecture continue en sourdine
      video.muted = true;
      video.play().catch(() => undefined);
    });
  }, [story.kind, hold]);

  // Page quittée (gardée cachée par Next) : la vidéo s'arrête
  useLayoutEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  function remove() {
    startDelete(async () => {
      const result = await deleteStoryAction(story.id);
      if (result.ok) onDeleted();
      else setError(result.error);
    });
  }

  const who = ring.author.displayName ?? ring.author.username ?? "";
  const hoursLeft = Math.max(
    1,
    Math.ceil(
      (new Date(story.createdAt).getTime() + STORY_TTL_MS - now) / 3_600_000,
    ),
  );

  return (
    <>
      <ol
        aria-hidden="true"
        className="mr-10 grid gap-1 pt-2"
        style={{
          gridTemplateColumns: `repeat(${ring.stories.length}, minmax(0, 1fr))`,
        }}
      >
        {ring.stories.map((item, position) => (
          <li
            key={item.id}
            className="h-1 overflow-hidden rounded-full bg-foreground/25"
          >
            <span
              className="block h-full bg-foreground"
              style={{
                width: `${
                  position < index
                    ? 100
                    : position === index
                      ? Math.round(progress * 100)
                      : 0
                }%`,
              }}
            />
          </li>
        ))}
      </ol>

      <header className="mr-10 flex items-center gap-3">
        <Avatar name={who} url={ring.author.avatarUrl} className="size-9" />
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogTitle className="truncate text-sm font-semibold">
            {who}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            <time dateTime={story.createdAt}>
              {format.relativeTime(new Date(story.createdAt), now)}
            </time>
            {mine ? ` · ${t("expires", { hours: hoursLeft })}` : null}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={paused ? t("play") : t("pause")}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </Button>
        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("options")}
              disabled={deleting}
            >
              {deleting ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <EllipsisVertical aria-hidden="true" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="dark">
            {mine ? (
              <DropdownMenuItem variant="destructive" onSelect={remove}>
                <Trash2 aria-hidden="true" />
                {t("delete")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onReport}>
                <Flag aria-hidden="true" />
                {t("report")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <DialogDescription className="sr-only">
        {t("viewerDescription", { name: who })}
      </DialogDescription>

      {/* Média : toucher à gauche recule, à droite avance ; appuyer longtemps met en pause */}
      <div
        className="relative -mx-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {story.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.url}
            alt=""
            className="max-h-full w-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            src={story.url}
            poster={story.posterUrl ?? undefined}
            playsInline
            preload="auto"
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (video.duration > 0)
                setProgress(video.currentTime / video.duration);
            }}
            onEnded={onNext}
            className="max-h-full w-full object-contain"
          />
        )}
        <button
          type="button"
          aria-label={t("previous")}
          onClick={onPrevious}
          className="absolute inset-y-0 left-0 w-1/3 outline-none focus-visible:bg-foreground/10"
        >
          <ChevronLeft aria-hidden="true" className="sr-only" />
        </button>
        <button
          type="button"
          aria-label={t("next")}
          onClick={onNext}
          className="absolute inset-y-0 right-0 w-2/3 outline-none focus-visible:bg-foreground/10"
        >
          <ChevronRight aria-hidden="true" className="sr-only" />
        </button>
      </div>

      {story.caption ? (
        <p className="text-base break-words whitespace-pre-wrap">
          {story.caption}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}
    </>
  );
}

/** Nouvelle story : une photo ou une vidéo, une légende, puis « Publier ». */
function StoryComposer({
  open,
  onOpenChange,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}) {
  const t = useTranslations("Community.stories");
  const tErrors = useTranslations("Community.errors");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploads = useMediaUploads();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<CommunityError | null>(null);
  const [pending, startTransition] = useTransition();
  const item = uploads.items[0];
  const failure = error ?? uploads.error ?? item?.error ?? null;

  function reset() {
    uploads.reset();
    setCaption("");
    setError(null);
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await createStoryAction({
        media: JSON.parse(uploads.payload) as unknown,
        caption,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      onPosted();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent closeLabel={t("cancel")} className="sm:max-w-md">
        <DialogTitle>{t("composerTitle")}</DialogTitle>
        <DialogDescription>{t("composerDescription")}</DialogDescription>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            uploads.reset();
            setError(null);
            uploads.add(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        {item ? (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.previewUrl}
                alt=""
                className="max-h-[50dvh] w-full object-contain"
              />
            ) : (
              <video
                src={item.previewUrl}
                muted
                playsInline
                className="max-h-[50dvh] w-full object-contain"
              />
            )}
            {item.status === "processing" || item.status === "uploading" ? (
              <span className="dark absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-sm font-medium">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-5 animate-spin"
                />
                {item.status === "uploading"
                  ? t("uploading", { percent: Math.round(item.progress * 100) })
                  : t("preparing")}
              </span>
            ) : null}
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          {item ? t("change") : t("pick")}
        </Button>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-caption`} className="text-sm font-medium">
            {t("caption")}
          </label>
          <Input
            id={`${id}-caption`}
            value={caption}
            maxLength={STORY_CAPTION_MAX}
            placeholder={t("captionPlaceholder")}
            onChange={(event) => setCaption(event.currentTarget.value)}
          />
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {tErrors(failure)}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={
            pending || !item || item.status !== "done" || !uploads.ready
          }
          onClick={publish}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {pending ? t("publishing") : t("publish")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
