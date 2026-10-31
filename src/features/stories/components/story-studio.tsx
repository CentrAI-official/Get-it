"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  Flame,
  Hash,
  ImagePlus,
  LoaderCircle,
  MapPin,
  MessageCircleQuestion,
  Music,
  Pause,
  Play,
  Search,
  Smile,
  Sticker,
  Trash2,
  Type,
  Video,
  AtSign,
  ListChecks,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PILLARS, pillarIcons, type Pillar } from "@/config/pillars";
import type { CommunityError } from "@/features/community/rules";
import { CameraInputs } from "@/features/community/components/camera-menu";
import { useMediaUploads } from "@/features/community/use-media-uploads";
import { cn } from "@/lib/utils";
import type { MusicTrackItem } from "@/server/stories/music";
import {
  createStoryAction,
  listMusicAction,
  storyStickerDataAction,
} from "../actions";
import { EMOJI_CATEGORIES, STORY_EMOJI, type EmojiCategory } from "../emoji";
import {
  MUSIC_CLIP_MS,
  MUSIC_TABS,
  clampClipStart,
  type MusicTab,
} from "../music";
import {
  STORY_ALIGNS,
  STORY_COLORS,
  STORY_FONTS,
  STORY_HASHTAG_MAX,
  STORY_LOCATION_MAX,
  STORY_OVERLAYS_MAX,
  STORY_POLL_OPTION_MAX,
  STORY_POLL_QUESTION_MAX,
  STORY_QUESTION_MAX,
  STORY_SCALE,
  STORY_TEXT_BACKGROUNDS,
  STORY_TEXT_MAX,
  STORY_TEXT_SIZE,
  freeSpot,
  type StoryOverlay,
} from "../studio";
import {
  OverlayContent,
  STORY_FONT_FAMILIES,
  StoryFrame,
  overlayStyle,
  textStyle,
} from "./story-overlays";

type TextOverlay = Extract<StoryOverlay, { kind: "text" }>;
type Draft = Omit<TextOverlay, "x" | "y" | "scale" | "rotation">;
type ChosenMusic = { track: MusicTrackItem; startMs: number };
type Panel = "text" | "stickers" | "music" | null;
/** Un élément à poser : tout sauf sa place (le studio la choisit). */
type NewOverlay = StoryOverlay extends infer Item
  ? Item extends StoryOverlay
    ? Omit<Item, "id" | "x" | "y" | "scale" | "rotation">
    : never
  : never;

// Pas crypto.randomUUID : indisponible hors HTTPS (essai sur le Wi-Fi local)
const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const minutes = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
/** Largeur du cadre : il tient dans la zone qui le contient, au format 9:16. */
export const FRAME_WIDTH = "min(100cqw, calc(100cqh * 9 / 16))";

/**
 * Studio d'une nouvelle story, comme Instagram : la photo ou la vidéo, puis des
 * textes (police, couleur, taille, fond, alignement), des stickers et emoji
 * qu'on déplace au doigt, qu'on agrandit et tourne à deux doigts, qu'on jette
 * dans la corbeille, et une musique du catalogue Get iT.
 */
export function StoryStudio({
  open,
  onOpenChange,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}) {
  const t = useTranslations("Community.stories");
  const tStudio = useTranslations("Community.stories.studio");
  const tErrors = useTranslations("Community.errors");
  const tCamera = useTranslations("Community.camera");
  const inputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const uploads = useMediaUploads();
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [music, setMusic] = useState<ChosenMusic | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<CommunityError | null>(null);
  const [pending, startTransition] = useTransition();
  const item = uploads.items[0];
  const failure = error ?? uploads.error ?? item?.error ?? null;
  const ready = Boolean(item && item.status === "done" && uploads.ready);

  function reset() {
    uploads.reset();
    setOverlays([]);
    setMusic(null);
    setPanel(null);
    setDraft(null);
    setNotice(null);
    setError(null);
  }

  /** Ajoute un élément sur une place libre du cadre. */
  function add(overlay: NewOverlay) {
    const interactive = overlay.kind === "poll" || overlay.kind === "question";
    if (
      interactive &&
      overlays.some((item) => item.kind === "poll" || item.kind === "question")
    ) {
      setNotice(tStudio("interactiveLimit"));
      return false;
    }
    if (overlays.length >= STORY_OVERLAYS_MAX) {
      setNotice(tStudio("limit", { max: STORY_OVERLAYS_MAX }));
      return false;
    }
    setNotice(null);
    setOverlays((current) => [
      ...current,
      {
        ...overlay,
        id: newId(),
        ...freeSpot(current),
        scale: 1,
        rotation: 0,
      } as StoryOverlay,
    ]);
    return true;
  }

  function openText(existing?: TextOverlay) {
    setDraft(
      existing ?? {
        id: newId(),
        kind: "text",
        text: "",
        font: "classic",
        color: "#ffffff",
        background: "none",
        align: "center",
        size: STORY_TEXT_SIZE.initial,
      },
    );
    setPanel("text");
  }

  function saveText() {
    const current = draft;
    setPanel(null);
    setDraft(null);
    if (!current) return;
    const text = current.text.trim();
    setOverlays((items) => {
      const existing = items.find((item) => item.id === current.id);
      if (!text) return items.filter((item) => item.id !== current.id);
      if (existing) {
        return items.map((item) =>
          item.id === current.id ? { ...existing, ...current, text } : item,
        );
      }
      return [
        ...items,
        { ...current, text, ...freeSpot(items), scale: 1, rotation: 0 },
      ];
    });
  }

  function chooseMusic(chosen: ChosenMusic | null) {
    setMusic(chosen);
    setPanel(null);
    setOverlays((items) => {
      const without = items.filter((item) => item.kind !== "music");
      return chosen
        ? [
            ...without,
            {
              id: newId(),
              kind: "music",
              ...freeSpot(without),
              scale: 1,
              rotation: 0,
            },
          ]
        : without;
    });
  }

  /** Une photo ou une vidéo choisie (galerie ou caméra) remplace la précédente. */
  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    uploads.reset();
    setError(null);
    uploads.add(event.currentTarget.files);
    event.currentTarget.value = "";
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await createStoryAction({
        media: JSON.parse(uploads.payload) as unknown,
        overlays,
        music: music
          ? { trackId: music.track.id, startMs: music.startMs }
          : null,
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
      <DialogContent className="dark inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none bg-black p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(56rem,calc(100dvh-2rem))] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1">
        <DialogTitle className="sr-only">{t("composerTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {tStudio("description")}
        </DialogDescription>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          tabIndex={-1}
          onChange={choose}
        />
        <CameraInputs
          photoRef={photoRef}
          videoRef={videoRef}
          onChange={choose}
        />

        {/* Barre du haut : fermer, puis les outils du studio */}
        <header className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tStudio("close")}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="size-11 rounded-full"
          >
            <X aria-hidden="true" className="size-6" />
          </Button>
          {item ? (
            <div className="ml-auto flex items-center gap-1">
              <ToolButton
                label={tStudio("text")}
                onClick={() => {
                  setNotice(null);
                  openText();
                }}
                icon={<Type aria-hidden="true" className="size-6" />}
              />
              <ToolButton
                label={tStudio("stickers")}
                onClick={() => {
                  setNotice(null);
                  setPanel("stickers");
                }}
                icon={<Sticker aria-hidden="true" className="size-6" />}
              />
              <ToolButton
                label={tStudio("music")}
                active={music !== null}
                onClick={() => {
                  setNotice(null);
                  setPanel("music");
                }}
                icon={<Music aria-hidden="true" className="size-6" />}
              />
            </div>
          ) : null}
        </header>

        <div className="[container-type:size] relative flex min-h-0 flex-1 items-center justify-center">
          {item ? (
            <EditableFrame
              item={item}
              overlays={overlays}
              music={music}
              onChange={setOverlays}
              onEditText={openText}
            />
          ) : (
            // Caméra d'abord, comme Instagram ; la galerie ensuite
            <div
              className="flex aspect-[9/16] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-foreground/25 p-6"
              style={{ width: FRAME_WIDTH }}
            >
              <p className="mb-2 text-center text-base font-semibold">
                {t("pick")}
              </p>
              <Button
                type="button"
                className="h-12 w-full max-w-60 rounded-full text-base"
                onClick={() => photoRef.current?.click()}
              >
                <Camera aria-hidden="true" />
                {tCamera("photo")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full max-w-60 rounded-full text-base"
                onClick={() => videoRef.current?.click()}
              >
                <Video aria-hidden="true" />
                {tCamera("video")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full max-w-60 rounded-full text-base"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus aria-hidden="true" />
                {tCamera("gallery")}
              </Button>
            </div>
          )}
          {panel === "text" && draft ? (
            <TextPanel draft={draft} onChange={setDraft} onDone={saveText} />
          ) : null}
          {panel === "stickers" ? (
            <StickerPanel
              onClose={() => setPanel(null)}
              onAdd={(overlay) => {
                if (add(overlay)) setPanel(null);
              }}
            />
          ) : null}
          {panel === "music" ? (
            <MusicPanel
              current={music}
              onClose={() => setPanel(null)}
              onChoose={chooseMusic}
            />
          ) : null}
        </div>

        {notice || failure ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {notice ?? (failure ? tErrors(failure) : null)}
          </p>
        ) : null}

        <footer className="flex items-center gap-2">
          {item ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              {t("change")}
            </Button>
          ) : null}
          {item && item.status !== "done" ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {item.status === "uploading"
                ? t("uploading", { percent: Math.round(item.progress * 100) })
                : t("preparing")}
            </span>
          ) : null}
          <Button
            type="button"
            className="ml-auto h-11 rounded-full px-6 text-base"
            disabled={pending || !ready || panel !== null}
            onClick={publish}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {pending ? tStudio("publishing") : tStudio("publish")}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function ToolButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-foreground/10",
      )}
    >
      {icon}
    </button>
  );
}

type Gesture = {
  id: string;
  start: StoryOverlay;
  initial: Map<number, { x: number; y: number }>;
  frame: DOMRect;
  moved: boolean;
};

/**
 * Le cadre du studio : chaque élément se déplace au doigt (ou aux flèches),
 * s'agrandit et tourne à deux doigts (ou avec + et −, [ et ]), et se jette
 * dans la corbeille (ou avec Suppr). Toucher un texte le modifie.
 */
function EditableFrame({
  item,
  overlays,
  music,
  onChange,
  onEditText,
}: {
  item: { kind: "image" | "video"; previewUrl: string };
  overlays: StoryOverlay[];
  music: ChosenMusic | null;
  onChange: (update: (items: StoryOverlay[]) => StoryOverlay[]) => void;
  onEditText: (item: TextOverlay) => void;
}) {
  const tStudio = useTranslations("Community.stories.studio");
  const frameRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  // Élément en train d'être déplacé (la corbeille apparaît)
  const [dragging, setDragging] = useState<string | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [now] = useState(() => new Date());

  const update = (id: string, change: (item: StoryOverlay) => StoryOverlay) =>
    onChange((items) =>
      items.map((item) => (item.id === id ? change(item) : item)),
    );
  const remove = (id: string) =>
    onChange((items) => items.filter((item) => item.id !== id));

  function begin(event: PointerEvent<HTMLDivElement>, overlay: StoryOverlay) {
    const frame = frameRef.current?.getBoundingClientRect();
    if (!frame) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const current = overlays.find((item) => item.id === overlay.id) ?? overlay;
    gesture.current = {
      id: overlay.id,
      start: current,
      initial: new Map(pointers.current),
      frame,
      moved: gesture.current?.id === overlay.id ? gesture.current.moved : false,
    };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointers.current.values()];
    const initial = [...active.initial.values()];
    const [a, b] = points;
    const [a0, b0] = initial;
    if (!a || !a0) return;
    const center = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    const center0 = b0 ? { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 } : a0;
    const dx = center.x - center0.x;
    const dy = center.y - center0.y;
    if (Math.hypot(dx, dy) > 4 || b) active.moved = true;
    if (!active.moved) return;
    setDragging(active.id);
    let scale = active.start.scale;
    let rotation = active.start.rotation;
    if (b && b0) {
      scale = clamp(
        active.start.scale *
          (Math.hypot(a.x - b.x, a.y - b.y) /
            Math.max(1, Math.hypot(a0.x - b0.x, a0.y - b0.y))),
        STORY_SCALE.min,
        STORY_SCALE.max,
      );
      const turn =
        (Math.atan2(b.y - a.y, b.x - a.x) -
          Math.atan2(b0.y - a0.y, b0.x - a0.x)) *
        (180 / Math.PI);
      rotation = ((active.start.rotation + turn + 540) % 360) - 180;
    }
    const trash = trashRef.current?.getBoundingClientRect();
    setOverTrash(
      Boolean(
        trash &&
        !b &&
        a.x >= trash.left - 12 &&
        a.x <= trash.right + 12 &&
        a.y >= trash.top - 12 &&
        a.y <= trash.bottom + 12,
      ),
    );
    update(active.id, (item) => ({
      ...item,
      x: clamp(active.start.x + dx / active.frame.width, 0, 1),
      y: clamp(active.start.y + dy / active.frame.height, 0, 1),
      scale,
      rotation,
    }));
  }

  function end(event: PointerEvent<HTMLDivElement>, overlay: StoryOverlay) {
    const active = gesture.current;
    pointers.current.delete(event.pointerId);
    if (!active) return;
    if (pointers.current.size > 0) {
      // Un doigt reste : il reprend le déplacement à partir d'ici
      const current = overlays.find((item) => item.id === active.id);
      gesture.current = {
        ...active,
        start: current ?? active.start,
        initial: new Map(pointers.current),
      };
      return;
    }
    gesture.current = null;
    setDragging(null);
    if (overTrash) remove(active.id);
    else if (!active.moved && overlay.kind === "text") onEditText(overlay);
    setOverTrash(false);
  }

  function keys(event: KeyboardEvent<HTMLDivElement>, overlay: StoryOverlay) {
    const step = event.shiftKey ? 0.08 : 0.02;
    const changes: Record<string, (item: StoryOverlay) => StoryOverlay> = {
      ArrowLeft: (item) => ({ ...item, x: clamp(item.x - step, 0, 1) }),
      ArrowRight: (item) => ({ ...item, x: clamp(item.x + step, 0, 1) }),
      ArrowUp: (item) => ({ ...item, y: clamp(item.y - step, 0, 1) }),
      ArrowDown: (item) => ({ ...item, y: clamp(item.y + step, 0, 1) }),
      "+": (item) => ({
        ...item,
        scale: clamp(item.scale + 0.1, STORY_SCALE.min, STORY_SCALE.max),
      }),
      "-": (item) => ({
        ...item,
        scale: clamp(item.scale - 0.1, STORY_SCALE.min, STORY_SCALE.max),
      }),
      "]": (item) => ({
        ...item,
        rotation: clamp(item.rotation + 5, -180, 180),
      }),
      "[": (item) => ({
        ...item,
        rotation: clamp(item.rotation - 5, -180, 180),
      }),
    };
    const change = changes[event.key];
    if (change) {
      event.preventDefault();
      update(overlay.id, change);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(overlay.id);
    } else if (event.key === "Enter" && overlay.kind === "text") {
      event.preventDefault();
      onEditText(overlay);
    }
  }

  const describe = (overlay: StoryOverlay) =>
    overlay.kind === "text"
      ? overlay.text
      : overlay.kind === "emoji"
        ? overlay.emoji
        : tStudio(`stickerTypes.${overlay.kind}`);

  return (
    <div ref={frameRef} style={{ width: FRAME_WIDTH }}>
      <StoryFrame
        kind={item.kind}
        src={item.previewUrl}
        videoProps={{ muted: true, autoPlay: true, loop: true }}
      >
        <div className="absolute inset-0 touch-none overflow-hidden">
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              role="button"
              tabIndex={0}
              aria-label={tStudio("itemLabel", { label: describe(overlay) })}
              className={cn(
                "absolute cursor-grab touch-none rounded-lg outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/70 active:cursor-grabbing",
                dragging === overlay.id && overTrash && "opacity-50",
              )}
              style={overlayStyle(overlay)}
              onPointerDown={(event) => begin(event, overlay)}
              onPointerMove={move}
              onPointerUp={(event) => end(event, overlay)}
              onPointerCancel={(event) => end(event, overlay)}
              onKeyDown={(event) => keys(event, overlay)}
            >
              <OverlayContent
                item={overlay}
                context={{
                  createdAt: now,
                  music: music
                    ? { title: music.track.title, artist: music.track.artist }
                    : null,
                  editing: true,
                }}
              />
            </div>
          ))}
        </div>
        {dragging ? (
          <div
            ref={trashRef}
            aria-hidden="true"
            className={cn(
              "absolute bottom-4 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-foreground/70 bg-background/60 text-foreground transition-transform",
              overTrash && "scale-125 border-destructive bg-destructive",
            )}
          >
            <Trash2 className="size-6" />
          </div>
        ) : null}
      </StoryFrame>
      {overlays.length > 0 ? (
        <p className="sr-only">{tStudio("keyboardHelp")}</p>
      ) : null}
    </div>
  );
}

/** Éditeur de texte plein écran : police, couleur, taille, fond et alignement. */
function TextPanel({
  draft,
  onChange,
  onDone,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onDone: () => void;
}) {
  const tStudio = useTranslations("Community.stories.studio");
  const id = useId();
  const AlignIcon =
    draft.align === "left"
      ? AlignLeft
      : draft.align === "right"
        ? AlignRight
        : AlignCenter;
  const nextOf = <T,>(list: readonly T[], value: T) =>
    list[(list.indexOf(value) + 1) % list.length] as T;

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-3 rounded-2xl bg-background/80 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={tStudio(`align.${draft.align}`)}
          onClick={() =>
            onChange({ ...draft, align: nextOf(STORY_ALIGNS, draft.align) })
          }
          className="flex size-11 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <AlignIcon aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          aria-label={tStudio(`background.${draft.background}`)}
          onClick={() =>
            onChange({
              ...draft,
              background: nextOf(STORY_TEXT_BACKGROUNDS, draft.background),
            })
          }
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-base font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            draft.background === "solid"
              ? "bg-foreground text-background"
              : draft.background === "soft"
                ? "bg-foreground/30"
                : "border border-foreground/60",
          )}
        >
          A
        </button>
        <Button
          type="button"
          onClick={onDone}
          className="ml-auto h-11 rounded-full px-5"
        >
          {tStudio("done")}
        </Button>
      </div>

      <div
        role="radiogroup"
        aria-label={tStudio("fontLabel")}
        className="-mx-3 flex [scrollbar-width:none] gap-2 overflow-x-auto px-3"
      >
        {STORY_FONTS.map((font) => (
          <button
            key={font}
            type="button"
            role="radio"
            aria-checked={draft.font === font}
            onClick={() => onChange({ ...draft, font })}
            style={{ fontFamily: STORY_FONT_FAMILIES[font] }}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              draft.font === font
                ? "bg-foreground text-background"
                : "bg-foreground/15",
              font === "strong" && "uppercase",
            )}
          >
            {tStudio(`fonts.${font}`)}
          </button>
        ))}
      </div>

      <div className="[container-type:inline-size] relative flex min-h-0 flex-1 items-center gap-3">
        {/* Taille : glissière verticale, comme Instagram */}
        <label htmlFor={`${id}-size`} className="sr-only">
          {tStudio("sizeLabel")}
        </label>
        <input
          id={`${id}-size`}
          type="range"
          min={STORY_TEXT_SIZE.min}
          max={STORY_TEXT_SIZE.max}
          step={0.005}
          value={draft.size}
          onChange={(event) =>
            onChange({ ...draft, size: Number(event.target.value) })
          }
          className="h-40 w-6 shrink-0 cursor-pointer accent-foreground [direction:rtl] [writing-mode:vertical-lr]"
        />
        <div className="flex min-w-0 flex-1 justify-center">
          <label htmlFor={`${id}-text`} className="sr-only">
            {tStudio("textLabel")}
          </label>
          <textarea
            id={`${id}-text`}
            autoFocus
            rows={3}
            value={draft.text}
            maxLength={STORY_TEXT_MAX}
            placeholder={tStudio("textPlaceholder")}
            onChange={(event) =>
              onChange({ ...draft, text: event.target.value })
            }
            style={{
              ...textStyle({ ...draft, x: 0, y: 0, scale: 1, rotation: 0 }),
              maxWidth: "100%",
              width: "100%",
            }}
            className="resize-none border-0 bg-transparent outline-none placeholder:text-foreground/50"
          />
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={tStudio("colorLabel")}
        className="flex flex-wrap justify-center gap-2"
      >
        {STORY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={draft.color === color}
            aria-label={tStudio("color", { color })}
            onClick={() => onChange({ ...draft, color })}
            className={cn(
              "size-9 rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              draft.color === color
                ? "scale-110 border-foreground"
                : "border-foreground/40",
            )}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

type StickerForm =
  | "location"
  | "hashtag"
  | "mention"
  | "streak"
  | "pillar"
  | "poll"
  | "question"
  | null;

/** Les stickers Get iT et les emoji, dans un panneau qui monte du bas. */
function StickerPanel({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (overlay: NewOverlay) => void;
}) {
  const tStudio = useTranslations("Community.stories.studio");
  const tPillars = useTranslations("Pillars");
  const id = useId();
  const [form, setForm] = useState<StickerForm>(null);
  const [category, setCategory] = useState<EmojiCategory>("smileys");
  const [value, setValue] = useState("");
  const [options, setOptions] = useState<[string, string]>(["", ""]);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof storyStickerDataAction>
  > | null>(null);
  const [loading, startLoading] = useTransition();

  function open(next: StickerForm) {
    setForm(next);
    setValue(next === "question" ? tStudio("questionDefault") : "");
    setOptions(next === "poll" ? [tStudio("yes"), tStudio("no")] : ["", ""]);
    if ((next === "mention" || next === "streak") && !data) {
      startLoading(async () => setData(await storyStickerDataAction()));
    }
  }

  const stickers = [
    { kind: "time", icon: Clock, action: () => onAdd({ kind: "time" }) },
    { kind: "date", icon: Calendar, action: () => onAdd({ kind: "date" }) },
    { kind: "location", icon: MapPin, action: () => open("location") },
    { kind: "mention", icon: AtSign, action: () => open("mention") },
    { kind: "hashtag", icon: Hash, action: () => open("hashtag") },
    { kind: "streak", icon: Flame, action: () => open("streak") },
    { kind: "pillar", icon: Smile, action: () => open("pillar") },
    { kind: "poll", icon: ListChecks, action: () => open("poll") },
    {
      kind: "question",
      icon: MessageCircleQuestion,
      action: () => open("question"),
    },
  ] as const;

  const field =
    "h-11 w-full rounded-xl border border-foreground/15 bg-foreground/10 px-3 text-base text-foreground outline-none placeholder:text-foreground/50 focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div
      role="dialog"
      aria-label={tStudio("stickers")}
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[78%] flex-col gap-3 overflow-y-auto rounded-3xl border border-foreground/10 bg-raised p-4"
    >
      <div className="flex items-center gap-2">
        {form ? (
          <button
            type="button"
            aria-label={tStudio("back")}
            onClick={() => setForm(null)}
            className="flex size-10 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </button>
        ) : null}
        <p className="text-base font-semibold">
          {form ? tStudio(`stickerTypes.${form}`) : tStudio("stickers")}
        </p>
        <button
          type="button"
          aria-label={tStudio("close")}
          onClick={onClose}
          className="ml-auto flex size-10 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      {form === null ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {stickers.map(({ kind, icon: Icon, action }) => (
              <button
                key={kind}
                type="button"
                onClick={action}
                className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-neutral-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon aria-hidden="true" className="size-4 text-[#c2410c]" />
                {tStudio(`stickerTypes.${kind}`)}
              </button>
            ))}
          </div>
          <div
            role="tablist"
            aria-label={tStudio("emoji")}
            className="-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-4"
          >
            {EMOJI_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={category === value}
                onClick={() => setCategory(value)}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  category === value
                    ? "bg-foreground/20 font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {tStudio(`emojiCategories.${value}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {STORY_EMOJI[category].map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                onClick={() => onAdd({ kind: "emoji", emoji })}
                className="flex aspect-square items-center justify-center rounded-lg text-2xl outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      ) : form === "location" || form === "hashtag" || form === "question" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const text = value.trim().replace(/^#/, "");
            if (!text) return;
            onAdd(
              form === "location"
                ? { kind: "location", text }
                : form === "hashtag"
                  ? {
                      kind: "hashtag",
                      text: text.replace(/[^\p{L}\p{N}_]/gu, ""),
                    }
                  : { kind: "question", prompt: text },
            );
          }}
        >
          <label htmlFor={`${id}-value`} className="sr-only">
            {tStudio(`stickerTypes.${form}`)}
          </label>
          <input
            id={`${id}-value`}
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={
              form === "location"
                ? STORY_LOCATION_MAX
                : form === "hashtag"
                  ? STORY_HASHTAG_MAX + 1
                  : STORY_QUESTION_MAX
            }
            placeholder={tStudio(`${form}Placeholder`)}
            className={field}
          />
          <Button type="submit" className="h-11 rounded-full">
            {tStudio("add")}
          </Button>
        </form>
      ) : form === "poll" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const question = value.trim();
            const [a, b] = options.map((option) => option.trim());
            if (!question || !a || !b) return;
            onAdd({ kind: "poll", question, options: [a, b] });
          }}
        >
          <label htmlFor={`${id}-question`} className="text-sm font-medium">
            {tStudio("pollQuestion")}
          </label>
          <input
            id={`${id}-question`}
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={STORY_POLL_QUESTION_MAX}
            placeholder={tStudio("pollQuestionPlaceholder")}
            className={field}
          />
          {options.map((option, index) => (
            <input
              key={index}
              aria-label={tStudio("pollOption", { n: index + 1 })}
              value={option}
              onChange={(event) =>
                setOptions((current) => {
                  const next: [string, string] = [...current];
                  next[index] = event.target.value;
                  return next;
                })
              }
              maxLength={STORY_POLL_OPTION_MAX}
              className={field}
            />
          ))}
          <Button type="submit" className="h-11 rounded-full">
            {tStudio("add")}
          </Button>
        </form>
      ) : form === "pillar" ? (
        <div className="grid grid-cols-2 gap-2">
          {PILLARS.map((pillar: Pillar) => {
            const Icon = pillarIcons[pillar];
            return (
              <button
                key={pillar}
                type="button"
                onClick={() => onAdd({ kind: "pillar", pillar })}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-neutral-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon aria-hidden="true" className="size-4 text-[#c2410c]" />
                {tPillars(`${pillar}.name`)}
              </button>
            );
          })}
        </div>
      ) : loading || !data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {tStudio("loading")}
        </p>
      ) : form === "mention" ? (
        data.contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tStudio("noContacts")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {data.contacts.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() =>
                    onAdd({
                      kind: "mention",
                      userId: person.id,
                      username: person.username,
                    })
                  }
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-semibold">{person.name}</span>
                  <span className="text-sm text-muted-foreground">
                    @{person.username}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : data.streaks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tStudio("noHabits")}</p>
      ) : (
        <ul className="flex flex-col">
          {data.streaks.map((habit) => (
            <li key={habit.id}>
              <button
                type="button"
                onClick={() =>
                  onAdd({
                    kind: "streak",
                    habitId: habit.id,
                    title: habit.title,
                    days: habit.days,
                  })
                }
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Flame
                  aria-hidden="true"
                  className="size-4 shrink-0 text-primary"
                />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {habit.title}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {tStudio("days", { count: habit.days })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Musique : Tendances, Pour toi et Recherche dans le catalogue Get iT, écoute
 * d'un morceau, puis choix de l'extrait de 15 secondes.
 */
function MusicPanel({
  current,
  onClose,
  onChoose,
}: {
  current: ChosenMusic | null;
  onClose: () => void;
  onChoose: (music: ChosenMusic | null) => void;
}) {
  const tStudio = useTranslations("Community.stories.studio");
  const id = useId();
  const audio = useRef<HTMLAudioElement>(null);
  const [tab, setTab] = useState<MusicTab>("trending");
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<MusicTrackItem[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [picked, setPicked] = useState<ChosenMusic | null>(current);
  const [loading, startLoading] = useTransition();

  function load(nextTab: MusicTab, nextQuery: string) {
    setTab(nextTab);
    startLoading(async () => {
      setTracks(await listMusicAction(nextTab, nextQuery));
    });
  }

  // Premier affichage : les tendances (chargées une fois, sans attendre un geste)
  useEffect(() => {
    startLoading(async () => setTracks(await listMusicAction("trending", "")));
  }, []);

  // Panneau fermé : la musique s'arrête
  useEffect(() => {
    const player = audio.current;
    return () => player?.pause();
  }, []);

  function listen(track: MusicTrackItem, fromMs = 0) {
    const player = audio.current;
    if (!player) return;
    if (playing === track.id && fromMs === 0) {
      player.pause();
      setPlaying(null);
      return;
    }
    player.src = track.url;
    player.currentTime = fromMs / 1000;
    void player.play().catch(() => undefined);
    setPlaying(track.id);
  }

  return (
    <div
      role="dialog"
      aria-label={tStudio("music")}
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[82%] flex-col gap-3 overflow-y-auto rounded-3xl border border-foreground/10 bg-raised p-4"
    >
      <audio
        ref={audio}
        onTimeUpdate={(event) => {
          // Extrait choisi : on n'écoute que ses 15 secondes
          const player = event.currentTarget;
          if (picked && playing === picked.track.id) {
            if (player.currentTime * 1000 >= picked.startMs + MUSIC_CLIP_MS) {
              player.pause();
              setPlaying(null);
            }
          }
        }}
        onEnded={() => setPlaying(null)}
      />
      <div className="flex items-center gap-2">
        {picked ? (
          <button
            type="button"
            aria-label={tStudio("back")}
            onClick={() => {
              audio.current?.pause();
              setPlaying(null);
              setPicked(null);
            }}
            className="flex size-10 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </button>
        ) : null}
        <p className="text-base font-semibold">{tStudio("music")}</p>
        <button
          type="button"
          aria-label={tStudio("close")}
          onClick={onClose}
          className="ml-auto flex size-10 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      {picked ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-lg font-bold">{picked.track.title}</p>
            <p className="text-sm text-muted-foreground">
              {picked.track.artist}
            </p>
          </div>
          <label htmlFor={`${id}-clip`} className="text-sm font-medium">
            {tStudio("clipLabel")}
          </label>
          <input
            id={`${id}-clip`}
            type="range"
            min={0}
            max={Math.max(0, picked.track.durationMs - MUSIC_CLIP_MS)}
            step={500}
            value={picked.startMs}
            aria-valuetext={tStudio("clip", {
              from: minutes(picked.startMs),
              to: minutes(picked.startMs + MUSIC_CLIP_MS),
            })}
            onChange={(event) =>
              setPicked({
                ...picked,
                startMs: clampClipStart(
                  Number(event.target.value),
                  picked.track.durationMs,
                ),
              })
            }
            onPointerUp={() => listen(picked.track, picked.startMs)}
            className="h-11 w-full cursor-pointer accent-primary"
          />
          <p className="text-sm text-muted-foreground tabular-nums">
            {tStudio("clip", {
              from: minutes(picked.startMs),
              to: minutes(picked.startMs + MUSIC_CLIP_MS),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              onClick={() =>
                playing === picked.track.id
                  ? (audio.current?.pause(), setPlaying(null))
                  : listen(picked.track, picked.startMs)
              }
            >
              {playing === picked.track.id ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {playing === picked.track.id
                ? tStudio("pause")
                : tStudio("listenClip")}
            </Button>
            <Button
              type="button"
              className="ml-auto h-11 rounded-full px-6"
              onClick={() => {
                audio.current?.pause();
                onChoose(picked);
              }}
            >
              {tStudio("done")}
            </Button>
          </div>
          {current ? (
            <Button
              type="button"
              variant="ghost"
              className="w-fit text-destructive"
              onClick={() => {
                audio.current?.pause();
                onChoose(null);
              }}
            >
              {tStudio("removeMusic")}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={tStudio("music")}
            className="flex gap-1"
          >
            {MUSIC_TABS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => load(value, value === "search" ? query : "")}
                className={cn(
                  "h-9 rounded-full px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab === value
                    ? "bg-foreground/20 font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {tStudio(`musicTabs.${value}`)}
              </button>
            ))}
          </div>
          {tab === "search" ? (
            <form
              role="search"
              className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-foreground/10 px-3"
              onSubmit={(event) => {
                event.preventDefault();
                load("search", query);
              }}
            >
              <Search
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <label htmlFor={`${id}-search`} className="sr-only">
                {tStudio("musicSearch")}
              </label>
              <input
                id={`${id}-search`}
                autoFocus
                value={query}
                maxLength={60}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tStudio("musicSearch")}
                className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-foreground/50"
              />
            </form>
          ) : null}
          {loading || tracks === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {tStudio("loading")}
            </p>
          ) : tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tab === "search" && query
                ? tStudio("musicNoResult")
                : tStudio("musicEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {tracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center gap-2 border-b border-foreground/10 py-1.5"
                >
                  <button
                    type="button"
                    aria-label={
                      playing === track.id
                        ? tStudio("pause")
                        : tStudio("play", { title: track.title })
                    }
                    onClick={() => listen(track)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {playing === track.id ? (
                      <Pause aria-hidden="true" className="size-4" />
                    ) : (
                      <Play aria-hidden="true" className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={tStudio("choose", { title: track.title })}
                    onClick={() => {
                      audio.current?.pause();
                      setPlaying(null);
                      setPicked({
                        track,
                        startMs:
                          current?.track.id === track.id ? current.startMs : 0,
                      });
                    }}
                    className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-lg px-1 text-left outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="max-w-full truncate font-semibold">
                      {track.title}
                    </span>
                    <span className="max-w-full truncate text-sm text-muted-foreground">
                      {track.artist} · {minutes(track.durationMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
