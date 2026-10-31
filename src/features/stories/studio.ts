import { z } from "zod";
import { PILLARS } from "@/config/pillars";

// Studio des stories, comme Instagram : textes, emoji et stickers posés sur le
// média. Position (x, y) du centre en part de la largeur et de la hauteur,
// échelle et rotation libres. Revalidé par le serveur, relu élément par élément.

/** Styles d'écriture : Inter, Anton, Lora, machine à écrire, néon. */
export const STORY_FONTS = [
  "classic",
  "strong",
  "serif",
  "typewriter",
  "neon",
] as const;
export type StoryFont = (typeof STORY_FONTS)[number];

/** Couleurs proposées pour le texte (le contenu de la personne, pas l'interface). */
export const STORY_COLORS = [
  "#ffffff",
  "#000000",
  "#ff6b00",
  "#ff3b30",
  "#ffd60a",
  "#30d158",
  "#64d2ff",
  "#0a84ff",
  "#bf5af2",
  "#ff375f",
] as const;

/** Fond du texte : aucun, plein, ou voile (comme le bouton « A » d'Instagram). */
export const STORY_TEXT_BACKGROUNDS = ["none", "solid", "soft"] as const;
export const STORY_ALIGNS = ["left", "center", "right"] as const;

export const STORY_TEXT_MAX = 150;
export const STORY_OVERLAYS_MAX = 20;
export const STORY_MENTIONS_MAX = 5;
export const STORY_LOCATION_MAX = 40;
export const STORY_HASHTAG_MAX = 30;
export const STORY_POLL_QUESTION_MAX = 80;
export const STORY_POLL_OPTION_MAX = 25;
export const STORY_QUESTION_MAX = 80;
export const STORY_ANSWER_MAX = 200;
/** Taille du texte, en part de la largeur de la story. */
export const STORY_TEXT_SIZE = {
  min: 0.04,
  max: 0.16,
  initial: 0.075,
} as const;
export const STORY_SCALE = { min: 0.3, max: 4 } as const;

/** Les stickers qu'on peut poser (le reste vient du sélecteur d'emoji). */
export const STORY_STICKERS = [
  "time",
  "date",
  "location",
  "mention",
  "hashtag",
  "streak",
  "pillar",
  "poll",
  "question",
] as const;

const placement = {
  id: z.string().regex(/^[a-z0-9-]{1,40}$/i),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(STORY_SCALE.min).max(STORY_SCALE.max),
  rotation: z.number().min(-180).max(180),
};
const short = (max: number) => z.string().trim().min(1).max(max);

const overlaySchema = z.discriminatedUnion("kind", [
  z.object({
    ...placement,
    kind: z.literal("text"),
    text: short(STORY_TEXT_MAX),
    font: z.enum(STORY_FONTS),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    background: z.enum(STORY_TEXT_BACKGROUNDS),
    align: z.enum(STORY_ALIGNS),
    size: z.number().min(STORY_TEXT_SIZE.min).max(STORY_TEXT_SIZE.max),
  }),
  z.object({
    ...placement,
    kind: z.literal("emoji"),
    emoji: z
      .string()
      .min(1)
      .max(16)
      .regex(/^\p{Extended_Pictographic}/u),
  }),
  z.object({ ...placement, kind: z.literal("time") }),
  z.object({ ...placement, kind: z.literal("date") }),
  z.object({
    ...placement,
    kind: z.literal("location"),
    text: short(STORY_LOCATION_MAX),
  }),
  z.object({
    ...placement,
    kind: z.literal("hashtag"),
    text: z
      .string()
      .trim()
      .regex(new RegExp(`^[\\p{L}\\p{N}_]{1,${STORY_HASHTAG_MAX}}$`, "u")),
  }),
  z.object({
    ...placement,
    kind: z.literal("mention"),
    userId: z.uuid(),
    /** Rempli par le serveur (jamais le texte du navigateur). */
    username: z.string().max(40).optional(),
  }),
  z.object({
    ...placement,
    kind: z.literal("streak"),
    habitId: z.uuid(),
    /** Figés par le serveur au moment de publier. */
    title: z.string().max(120).optional(),
    days: z.number().int().min(0).optional(),
  }),
  z.object({
    ...placement,
    kind: z.literal("pillar"),
    pillar: z.enum(PILLARS),
  }),
  z.object({
    ...placement,
    kind: z.literal("poll"),
    question: short(STORY_POLL_QUESTION_MAX),
    options: z.tuple([
      short(STORY_POLL_OPTION_MAX),
      short(STORY_POLL_OPTION_MAX),
    ]),
  }),
  z.object({
    ...placement,
    kind: z.literal("question"),
    prompt: short(STORY_QUESTION_MAX),
  }),
  z.object({ ...placement, kind: z.literal("music") }),
]);

export type StoryOverlay = z.infer<typeof overlaySchema>;
export type StoryOverlayKind = StoryOverlay["kind"];

/**
 * Les éléments d'une story : 20 au plus, 5 mentions au plus, un seul sticker
 * interactif (sondage ou question) et une seule étiquette de musique.
 */
export const storyOverlaysSchema = z
  .array(overlaySchema)
  .max(STORY_OVERLAYS_MAX, { error: "storyOverlays" })
  .superRefine((overlays, context) => {
    const count = (kinds: StoryOverlayKind[]) =>
      overlays.filter((item) => kinds.includes(item.kind)).length;
    const ids = new Set(overlays.map((item) => item.id));
    if (
      ids.size !== overlays.length ||
      count(["mention"]) > STORY_MENTIONS_MAX ||
      count(["poll", "question"]) > 1 ||
      count(["music"]) > 1
    ) {
      context.addIssue({ code: "custom", message: "storyOverlays" });
    }
  });

/** Relit les éléments enregistrés : ceux qui ne sont plus valides sont ignorés. */
export function readOverlays(value: unknown): StoryOverlay[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = overlaySchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Le sondage ou la question d'une story, s'il y en a un. */
// Places proposées aux nouveaux éléments, le centre d'abord
const SPOTS = [
  [0.5, 0.5],
  [0.5, 0.3],
  [0.5, 0.7],
  [0.3, 0.4],
  [0.7, 0.6],
  [0.3, 0.6],
  [0.7, 0.4],
  [0.5, 0.18],
  [0.5, 0.84],
  [0.28, 0.24],
  [0.72, 0.76],
  [0.72, 0.24],
  [0.28, 0.76],
] as const;

/**
 * Place d'un nouvel élément : celle qui est la plus loin de ceux déjà posés
 * (distances à l'échelle du cadre 9:16), pour qu'ils ne s'empilent pas.
 */
export function freeSpot(items: readonly { x: number; y: number }[]) {
  let best: readonly [number, number] = SPOTS[0];
  let bestDistance = -1;
  for (const spot of SPOTS) {
    const distance = Math.min(
      Infinity,
      ...items.map((item) =>
        Math.hypot(item.x - spot[0], (item.y - spot[1]) * (16 / 9)),
      ),
    );
    if (distance > bestDistance + 1e-9) {
      best = spot;
      bestDistance = distance;
    }
  }
  return { x: best[0], y: best[1] };
}

export function interactiveOf(overlays: readonly StoryOverlay[]) {
  return (
    overlays.find(
      (item): item is Extract<StoryOverlay, { kind: "poll" | "question" }> =>
        item.kind === "poll" || item.kind === "question",
    ) ?? null
  );
}

/** Pourcentages d'un sondage à deux options, arrondis pour faire 100. */
export function pollPercents(counts: readonly [number, number]) {
  const total = counts[0] + counts[1];
  if (total === 0) return [0, 0] as const;
  const first = Math.round((counts[0] / total) * 100);
  return [first, 100 - first] as const;
}

/** Réponse à une question, revalidée par le serveur. */
export const storyAnswerSchema = short(STORY_ANSWER_MAX);
