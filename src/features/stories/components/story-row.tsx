"use client";

import {
  EllipsisVertical,
  Eye,
  Flag,
  Heart,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  SendHorizontal,
  Trash2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
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
import { ProfileLink } from "@/components/profile-link";
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
import { ReportDialog } from "@/features/community/components/report-dialog";
import type { CommunityError } from "@/features/community/rules";
import { MESSAGE_MAX_LENGTH } from "@/features/messages/rules";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { StoryActivity, StoryRing } from "@/server/stories/service";
import {
  answerQuestionAction,
  deleteStoryAction,
  recordStoryViewAction,
  replyToStoryAction,
  storyActivityAction,
  votePollAction,
} from "../actions";
import { MUSIC_CLIP_MS } from "../music";
import {
  firstUnseenIndex,
  hasUnseen,
  imageDuration,
  orderRings,
  STORY_REACTIONS,
  STORY_TTL_MS,
} from "../rules";
import { markStorySeen, useSeenStories } from "../seen-store";
import { STORY_ANSWER_MAX } from "../studio";
import { OverlayLayer, StoryFrame } from "./story-overlays";
import { FRAME_WIDTH, StoryStudio } from "./story-studio";

const BUBBLE =
  "flex w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
// Stories en carré arrondi (maquette « Bento », décision du fondateur, 2026-10-29)
const RING = "flex size-16 rounded-[22px] p-[3px]";
const INNER = "flex size-full rounded-[19px] bg-background p-[2px]";
const FACE = "size-full rounded-[17px] text-lg";
/** Glissée vers le bas qui ferme la visionneuse, en pixels. */
const DISMISS_PX = 100;
/** Glissée sur le côté qui change de personne, en pixels. */
const SWIPE_PX = 70;

type DragOffset = { x: number; y: number };

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
      <StoryStudio
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
  onClose: closeViewer,
  now,
}: StoryViewerProps) {
  const t = useTranslations("Community.stories");
  const seen = useSeenStories();
  const ring = opened ? rings[opened.ring] : undefined;
  const story = opened && ring ? ring.stories[opened.story] : undefined;
  const [report, setReport] = useState<string | null>(null);
  // Son coupé ou non, gardé d'une story à l'autre
  const [muted, setMuted] = useState(false);
  // Glissée : la story suit le doigt ; vers le bas elle se ferme, sur le côté
  // elle passe à la personne suivante ou précédente (comme Instagram)
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  // Sens d'arrivée de la personne suivante (animation d'entrée)
  const [enter, setEnter] = useState<"left" | "right" | null>(null);

  /** Fermée : la prochaine ouverture arrive sans glisser. */
  function onClose(notice?: string) {
    setEnter(null);
    closeViewer(notice);
  }

  function dragTo(offset: DragOffset, done: boolean) {
    if (!done) return setDrag({ ...offset, active: true });
    setDrag({ x: 0, y: 0, active: false });
    if (offset.y >= DISMISS_PX) onClose();
    else if (offset.x <= -SWIPE_PX) nextRing();
    else if (offset.x >= SWIPE_PX) previousRing();
  }

  /** La personne suivante (ou la fermeture après la dernière). */
  function nextRing() {
    if (!opened) return;
    const following = rings[opened.ring + 1];
    if (!following) return onClose();
    setEnter("right");
    onChange({
      ring: opened.ring + 1,
      story: firstUnseenIndex(following, seen),
    });
  }

  /** La personne précédente (rien avant la première). */
  function previousRing() {
    if (!opened) return;
    const before = rings[opened.ring - 1];
    if (!before) return;
    setEnter("left");
    onChange({ ring: opened.ring - 1, story: firstUnseenIndex(before, seen) });
  }

  function next() {
    if (!opened || !ring) return;
    if (opened.story < ring.stories.length - 1) {
      onChange({ ring: opened.ring, story: opened.story + 1 });
      return;
    }
    const following = rings[opened.ring + 1];
    if (following) {
      setEnter("right");
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
      setEnter("left");
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
          className={cn(
            "dark inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none bg-black p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(52rem,calc(100dvh-4rem))] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1",
            // Relâchée avant le seuil : la story revient en douceur
            !drag.active && "transition-[transform,opacity,border-radius]",
          )}
          style={
            drag.y > 0
              ? {
                  transform: `translateY(${drag.y}px) scale(${1 - Math.min(drag.y, 400) / 2000})`,
                  opacity: 1 - Math.min(drag.y, 400) / 800,
                  borderRadius: "1.5rem",
                }
              : drag.x !== 0
                ? {
                    transform: `translateX(${drag.x}px)`,
                    opacity: 1 - Math.min(Math.abs(drag.x), 400) / 1000,
                  }
                : undefined
          }
        >
          {ring && story && opened ? (
            // Une personne à la fois : elle arrive du côté où l'on a glissé
            <div
              key={ring.author.id}
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-3",
                enter === "right" && "story-in-right",
                enter === "left" && "story-in-left",
              )}
            >
              {/* Une story à la fois : son état (avancement, pause) repart de zéro */}
              <StoryStage
                key={story.id}
                ring={ring}
                index={opened.story}
                mine={ring.author.id === mineId}
                held={report !== null}
                muted={muted}
                onMutedChange={setMuted}
                now={now}
                onNext={next}
                onPrevious={previous}
                onDrag={dragTo}
                onLeave={() => onClose()}
                onReport={() => setReport(story.id)}
                onDeleted={() => onClose(t("deleted"))}
              />
            </div>
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
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  now: number;
  onNext: () => void;
  onPrevious: () => void;
  /** Glissée (bas ou côté) : sa distance pendant le geste, puis `done` au relâchement. */
  onDrag: (offset: DragOffset, done: boolean) => void;
  /** On quitte la visionneuse pour un profil. */
  onLeave: () => void;
  onReport: () => void;
  onDeleted: () => void;
};

type Sheet = "reply" | "answer" | "activity" | null;

/**
 * Une story : barres d'avancement, auteur, le cadre 9:16 avec ses textes et
 * stickers, la musique, puis la barre de réponse (ou « Vu par » pour l'auteur).
 */
function StoryStage({
  ring,
  index,
  mine,
  held,
  muted,
  onMutedChange,
  now,
  onNext,
  onPrevious,
  onDrag,
  onLeave,
  onReport,
  onDeleted,
}: StoryStageProps) {
  const t = useTranslations("Community.stories");
  const tStudio = useTranslations("Community.stories.studio");
  const tErrors = useTranslations("Community.errors");
  const format = useFormatter();
  // ring.stories[index] existe : la visionneuse ne rend StoryStage qu'avec une story
  const story = ring.stories[index]!;
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [progress, setProgress] = useState(0);
  const [poll, setPoll] = useState(story.poll);
  const [answered, setAnswered] = useState(story.answered);
  const [notice, setNotice] = useState<string | null>(null);
  const elapsed = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<CommunityError | null>(null);
  const [deleting, startDelete] = useTransition();
  const hold = paused || menuOpen || held || sheet !== null;
  const advance = useEffectEvent(() => onNext());
  // Geste en cours sur le cadre : appui long (pause), glissée vers le bas
  // (fermer) ou sur le côté (changer de personne)
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    axis: "x" | "y" | null;
    offset: DragOffset;
  } | null>(null);
  const swallowClick = useRef(false);
  const muteRefused = useEffectEvent(() => onMutedChange(true));
  const music = story.music;
  const hasMusic = music !== null;
  const duration = imageDuration(hasMusic);
  const clipStart = (music?.startMs ?? 0) / 1000;
  const clipEnd = clipStart + MUSIC_CLIP_MS / 1000;

  // Une story affichée est vue : sur cet appareil (anneau), et pour son auteur (« Vu par »)
  useEffect(() => {
    markStorySeen(story.id);
    if (!mine) void recordStoryViewAction(story.id);
  }, [story.id, mine]);

  // Photo : la barre avance pendant 5 s (15 s avec une musique), puis la story suivante
  useEffect(() => {
    if (story.kind !== "image" || hold) return;
    let frame = 0;
    let last = performance.now();
    // Reprend là où la pause l'a arrêtée
    const tick = (time: number) => {
      elapsed.current = Math.min(1, elapsed.current + (time - last) / duration);
      last = time;
      setProgress(elapsed.current);
      if (elapsed.current >= 1) advance();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [story.kind, hold, duration]);

  // Vidéo : lecture et pause suivent l'état de la visionneuse (muette sous une musique)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || story.kind !== "video") return;
    video.muted = hasMusic || muted;
    if (hold) {
      video.pause();
      return;
    }
    video.play().catch(() => {
      // Son refusé sans geste : la lecture continue en sourdine
      video.muted = true;
      if (!hasMusic) muteRefused();
      video.play().catch(() => undefined);
    });
  }, [story.kind, hold, muted, hasMusic]);

  // Musique : l'extrait de 15 s, en boucle sous une vidéo
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasMusic) return;
    audio.muted = muted;
    if (hold) {
      audio.pause();
      return;
    }
    if (
      audio.readyState > 0 &&
      (audio.currentTime < clipStart || audio.currentTime >= clipEnd)
    ) {
      audio.currentTime = clipStart;
    }
    audio.play().catch(() => muteRefused());
  }, [hold, muted, hasMusic, clipStart, clipEnd]);

  // Page quittée (gardée cachée par Next) : la vidéo et la musique s'arrêtent
  useLayoutEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    return () => {
      video?.pause();
      audio?.pause();
    };
  }, []);

  function remove() {
    startDelete(async () => {
      const result = await deleteStoryAction(story.id);
      if (result.ok) onDeleted();
      else setError(result.error);
    });
  }

  function endGesture() {
    const active = gesture.current;
    gesture.current = null;
    setPaused(false);
    if (active?.axis) onDrag(active.offset, true);
  }

  function vote(choice: 0 | 1) {
    // Le vote s'affiche tout de suite, puis les vrais chiffres arrivent
    setPoll((current) => {
      const counts: [number, number] = [...(current?.counts ?? [0, 0])];
      counts[choice] += 1;
      return { counts, mine: choice };
    });
    void votePollAction(story.id, choice).then((result) => {
      if (result.ok) setPoll({ counts: result.counts, mine: result.mine });
    });
  }

  const who = ring.author.displayName ?? ring.author.username ?? "";
  const hoursLeft = Math.max(
    1,
    Math.ceil(
      (new Date(story.createdAt).getTime() + STORY_TTL_MS - now) / 3_600_000,
    ),
  );
  const question = story.overlays.find((item) => item.kind === "question");
  const hasSound = hasMusic || story.kind === "video";

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

      <header className="mr-10 flex items-center gap-1">
        {/* L'auteur mène à son profil (la visionneuse se ferme) */}
        <ProfileLink
          username={ring.author.username}
          onClick={onLeave}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <Avatar name={who} url={ring.author.avatarUrl} className="size-9" />
          <span className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-sm font-semibold">
              {who}
            </DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              <time dateTime={story.createdAt}>
                {format.relativeTime(new Date(story.createdAt), now)}
              </time>
              {mine ? ` · ${t("expires", { hours: hoursLeft })}` : null}
            </p>
          </span>
        </ProfileLink>
        {hasSound ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={muted ? tStudio("unmute") : tStudio("mute")}
            onClick={() => onMutedChange(!muted)}
          >
            {muted ? (
              <VolumeX aria-hidden="true" />
            ) : (
              <Volume2 aria-hidden="true" />
            )}
          </Button>
        ) : null}
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

      {music ? (
        <audio
          ref={audioRef}
          src={music.url}
          preload="auto"
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = clipStart;
          }}
          onTimeUpdate={(event) => {
            // Fin de l'extrait : il reprend au début (la photo, elle, passe à la suite)
            const audio = event.currentTarget;
            if (audio.currentTime >= clipEnd) audio.currentTime = clipStart;
          }}
        />
      ) : null}

      {/* Le cadre : toucher à gauche recule, à droite avance ; appuyer longtemps met en pause */}
      <div className="[container-type:size] relative flex min-h-0 flex-1 items-center justify-center">
        <div
          className="relative touch-none select-none"
          style={{ width: FRAME_WIDTH }}
          onPointerDown={(event) => {
            setPaused(true);
            swallowClick.current = false;
            gesture.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              axis: null,
              offset: { x: 0, y: 0 },
            };
          }}
          onPointerMove={(event) => {
            const active = gesture.current;
            if (!active || active.id !== event.pointerId) return;
            const dy = event.clientY - active.y;
            const dx = event.clientX - active.x;
            // Vers le bas ou sur le côté : la story suit le doigt
            if (active.axis === null) {
              if (dy > 10 && dy > Math.abs(dx) * 1.2) active.axis = "y";
              else if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2)
                active.axis = "x";
              if (active.axis) swallowClick.current = true;
            }
            if (active.axis) {
              active.offset =
                active.axis === "y"
                  ? { x: 0, y: Math.max(0, dy) }
                  : { x: dx, y: 0 };
              onDrag(active.offset, false);
            }
          }}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onPointerLeave={endGesture}
          // Après une glissée, le toucher ne change pas de story
          onClickCapture={(event) => {
            if (!swallowClick.current) return;
            swallowClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <StoryFrame
            kind={story.kind}
            src={story.url}
            poster={story.posterUrl}
            videoRef={videoRef}
            videoProps={{
              preload: "auto",
              onTimeUpdate: (event) => {
                const video = event.currentTarget;
                if (video.duration > 0)
                  setProgress(video.currentTime / video.duration);
              },
              onEnded: onNext,
            }}
          >
            <button
              type="button"
              aria-label={t("previous")}
              onClick={onPrevious}
              className="absolute inset-y-0 left-0 w-1/3 outline-none focus-visible:bg-foreground/10"
            />
            <button
              type="button"
              aria-label={t("next")}
              onClick={onNext}
              className="absolute inset-y-0 right-0 w-2/3 outline-none focus-visible:bg-foreground/10"
            />
            <OverlayLayer
              overlays={story.overlays}
              context={{
                createdAt: new Date(story.createdAt),
                music: music
                  ? { title: music.title, artist: music.artist }
                  : null,
                poll,
                mine,
                answered,
                onVote: vote,
                onAnswer: () => setSheet("answer"),
              }}
            />
            {notice ? (
              <p
                role="status"
                className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white"
              >
                {notice}
              </p>
            ) : null}
          </StoryFrame>
        </div>
        {sheet === "answer" && question?.kind === "question" ? (
          <AnswerSheet
            storyId={story.id}
            prompt={question.prompt}
            onClose={() => setSheet(null)}
            onSent={() => {
              setSheet(null);
              setAnswered(true);
              setNotice(tStudio("answerSent"));
            }}
          />
        ) : null}
        {sheet === "activity" ? (
          <ActivitySheet
            storyId={story.id}
            now={now}
            onClose={() => setSheet(null)}
            onLeave={onLeave}
          />
        ) : null}
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

      {mine ? (
        <button
          type="button"
          onClick={() => setSheet("activity")}
          className="flex h-11 w-fit items-center gap-2 rounded-full px-3 text-sm font-semibold outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Eye aria-hidden="true" className="size-5" />
          {tStudio("viewedBy", { count: story.views })}
        </button>
      ) : (
        <ReplyBar
          storyId={story.id}
          name={who}
          open={sheet === "reply"}
          onOpenChange={(open) => setSheet(open ? "reply" : null)}
          onSent={(reaction) => {
            setSheet(null);
            setNotice(
              reaction ? tStudio("reactionSent") : tStudio("replySent"),
            );
          }}
        />
      )}
    </>
  );
}

/**
 * Répondre à une story : un message, ou une réaction rapide. Tout arrive dans la
 * Messagerie de l'auteur, avec un aperçu de la story.
 */
function ReplyBar({
  storyId,
  name,
  open,
  onOpenChange,
  onSent,
}: {
  storyId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (reaction: boolean) => void;
}) {
  const tStudio = useTranslations("Community.stories.studio");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function send(text: string, reaction: boolean) {
    setFailed(false);
    startTransition(async () => {
      const result = await replyToStoryAction(storyId, text);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setBody("");
      // Envoyé : le clavier se ferme et la story reprend
      inputRef.current?.blur();
      onSent(reaction);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <div
          role="group"
          aria-label={tStudio("reactions")}
          className="flex justify-around"
        >
          {STORY_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={tStudio("react", { emoji })}
              disabled={pending}
              // Le champ garde le focus : la story reste en pause
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => send(emoji, true)}
              className="flex size-12 items-center justify-center rounded-full text-3xl transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {tStudio("replyFailed")}
        </p>
      ) : null}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = body.trim();
          if (text) send(text, false);
        }}
      >
        <label htmlFor={`${id}-reply`} className="sr-only">
          {tStudio("replyLabel", { name })}
        </label>
        <input
          ref={inputRef}
          id={`${id}-reply`}
          value={body}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={tStudio("replyPlaceholder", { name })}
          onFocus={() => onOpenChange(true)}
          onBlur={() => {
            if (!body.trim()) onOpenChange(false);
          }}
          onChange={(event) => setBody(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-full border border-foreground/30 bg-transparent px-4 text-base outline-none placeholder:text-foreground/60 focus-visible:border-foreground/70"
        />
        {body.trim() ? (
          <Button
            type="submit"
            size="icon"
            aria-label={tStudio("send")}
            disabled={pending}
            className="size-11 rounded-full"
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <SendHorizontal aria-hidden="true" />
            )}
          </Button>
        ) : (
          <button
            type="button"
            aria-label={tStudio("react", { emoji: "❤️" })}
            disabled={pending}
            onClick={() => send("❤️", true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Heart aria-hidden="true" className="size-6" />
          </button>
        )}
      </form>
    </div>
  );
}

/** Réponse à la question d'une story : lue par son auteur seulement. */
function AnswerSheet({
  storyId,
  prompt,
  onClose,
  onSent,
}: {
  storyId: string;
  prompt: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const tStudio = useTranslations("Community.stories.studio");
  const tErrors = useTranslations("Community.errors");
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<CommunityError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      aria-label={prompt}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-3xl border border-foreground/10 bg-raised p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await answerQuestionAction(storyId, body);
          if (result.ok) onSent();
          else setError(result.error);
        });
      }}
    >
      <div className="flex items-start gap-2">
        <label
          htmlFor={`${id}-answer`}
          className="flex-1 text-base font-semibold break-words"
        >
          {prompt}
        </label>
        <button
          type="button"
          aria-label={tStudio("close")}
          onClick={onClose}
          className="-mt-1 flex size-10 shrink-0 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <textarea
        id={`${id}-answer`}
        autoFocus
        rows={3}
        value={body}
        maxLength={STORY_ANSWER_MAX}
        placeholder={tStudio("answerPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
        className="resize-none rounded-xl border border-foreground/15 bg-foreground/5 p-3 text-base outline-none placeholder:text-foreground/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <p className="text-xs text-muted-foreground">
        {tStudio("answerPrivacy")}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending || !body.trim()}
        className="h-11 rounded-full"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {tStudio("sendAnswer")}
      </Button>
    </form>
  );
}

/** Activité de ma story : qui l'a vue, les votes du sondage, les réponses. */
function ActivitySheet({
  storyId,
  now,
  onClose,
  onLeave,
}: {
  storyId: string;
  now: number;
  onClose: () => void;
  onLeave: () => void;
}) {
  const tStudio = useTranslations("Community.stories.studio");
  const format = useFormatter();
  const [activity, setActivity] = useState<StoryActivity | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let active = true;
    void storyActivityAction(storyId).then((result) => {
      if (active) setActivity(result);
    });
    return () => {
      active = false;
    };
  }, [storyId]);

  return (
    <div
      role="dialog"
      aria-label={tStudio("activity")}
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[85%] flex-col gap-4 overflow-y-auto rounded-3xl border border-foreground/10 bg-raised p-4"
    >
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold">{tStudio("activity")}</p>
        <button
          type="button"
          aria-label={tStudio("close")}
          onClick={onClose}
          className="ml-auto flex size-10 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      {activity === undefined ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {tStudio("loading")}
        </p>
      ) : activity === null ? (
        <p role="alert" className="text-sm text-destructive">
          {tStudio("activityFailed")}
        </p>
      ) : (
        <>
          {activity.poll ? <PollResults poll={activity.poll} /> : null}

          {activity.question ? (
            <section className="flex flex-col gap-2">
              <h3 className="caps-label text-muted-foreground">
                {activity.question.prompt}
              </h3>
              {activity.question.answers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tStudio("noAnswers")}
                </p>
              ) : (
                <ul className="flex flex-col">
                  {activity.question.answers.map((answer) => (
                    <li
                      key={answer.id}
                      className="border-b border-foreground/8 py-2"
                    >
                      <p className="text-sm font-semibold">{answer.name}</p>
                      <p className="text-base break-words whitespace-pre-wrap">
                        {answer.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h3 className="caps-label text-muted-foreground">
              {tStudio("viewedBy", { count: activity.views.length })}
            </h3>
            {activity.views.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tStudio("noViews")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {activity.views.map((viewer) => (
                  <li
                    key={viewer.id}
                    className="flex items-center gap-3 border-b border-foreground/8 py-2"
                  >
                    <ProfileLink
                      username={viewer.username}
                      onClick={onLeave}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <Avatar
                        name={viewer.name}
                        url={viewer.avatarUrl}
                        className="size-9"
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">
                          {viewer.name}
                        </span>
                        <time
                          dateTime={viewer.viewedAt}
                          className="text-xs text-muted-foreground"
                        >
                          {format.relativeTime(new Date(viewer.viewedAt), now)}
                        </time>
                      </span>
                    </ProfileLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Résultats du sondage pour l'auteur : chaque option, son nombre de votes et qui l'a choisie. */
function PollResults({ poll }: { poll: NonNullable<StoryActivity["poll"]> }) {
  const tStudio = useTranslations("Community.stories.studio");
  const format = useFormatter();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="caps-label text-muted-foreground">{poll.question}</h3>
      {poll.options.map((option, choice) => {
        const voters = poll.voters.filter((voter) => voter.choice === choice);
        return (
          <div key={choice} className="border-b border-foreground/8 pb-2">
            <p className="flex items-baseline gap-2 font-semibold">
              <span className="min-w-0 flex-1 truncate">{option}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {tStudio("votes", { count: poll.counts[choice] ?? 0 })}
              </span>
            </p>
            {voters.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {format.list(voters.map((voter) => voter.name))}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
