"use client";

import { Flame, MapPin, Music } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { journalFont } from "@/features/journal/font";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { pollPercents, type StoryFont, type StoryOverlay } from "../studio";

// Rendu des textes et stickers d'une story, le même dans le studio et dans la
// visionneuse. Les tailles sont en part de la largeur du cadre (unité cqw) :
// la story garde la même allure sur tous les écrans.

export const STORY_FONT_FAMILIES: Record<StoryFont, string> = {
  classic: "var(--font-inter), system-ui, sans-serif",
  strong: 'var(--font-anton), "Arial Narrow", sans-serif',
  serif: journalFont.style.fontFamily,
  typewriter:
    'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  neon: "var(--font-inter), system-ui, sans-serif",
};

/** Position, échelle et rotation d'un élément dans le cadre. */
export function overlayStyle(item: StoryOverlay): CSSProperties {
  return {
    left: `${item.x * 100}%`,
    top: `${item.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
  };
}

/** Noir ou blanc, le plus lisible sur une couleur de fond. */
export function readableOn(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [value >> 16, (value >> 8) & 255, value & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#000000" : "#ffffff";
}

/** Style d'un texte : police, couleur, taille, fond et alignement. */
export function textStyle(
  item: Extract<StoryOverlay, { kind: "text" }>,
): CSSProperties {
  const neon = item.font === "neon";
  const solid = item.background === "solid";
  return {
    fontFamily: STORY_FONT_FAMILIES[item.font],
    fontSize: `${item.size * 100}cqw`,
    fontWeight: item.font === "classic" || neon ? 700 : 400,
    fontStyle: item.font === "serif" ? "italic" : undefined,
    textTransform: item.font === "strong" ? "uppercase" : undefined,
    lineHeight: 1.15,
    textAlign: item.align,
    color: neon ? "#ffffff" : solid ? readableOn(item.color) : item.color,
    background: solid
      ? item.color
      : item.background === "soft"
        ? "rgba(0, 0, 0, 0.5)"
        : undefined,
    textShadow: neon
      ? `0 0 0.08em ${item.color}, 0 0 0.25em ${item.color}, 0 0 0.6em ${item.color}`
      : item.background === "none"
        ? "0 0.04em 0.18em rgba(0, 0, 0, 0.45)"
        : undefined,
    padding: item.background === "none" ? "0.1em 0.2em" : "0.25em 0.45em",
    borderRadius: "0.3em",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    maxWidth: "86cqw",
    display: "inline-block",
  };
}

const CHIP =
  "inline-flex items-center gap-[1.5cqw] rounded-[2.5cqw] bg-white px-[3cqw] py-[1.6cqw] text-[4.2cqw] font-bold whitespace-nowrap text-neutral-900 shadow-[0_0.6cqw_2cqw_rgba(0,0,0,0.25)]";

export type OverlayContext = {
  /** Heure et date des stickers « heure » et « date » : la publication de la story. */
  createdAt: Date;
  music: { title: string; artist: string } | null;
  /** Visionneuse : les votes du sondage (montrés après avoir voté, ou à l'auteur). */
  poll?: { counts: [number, number]; mine: number | null } | null;
  /** Je suis l'auteur : les résultats se voient, on ne vote pas. */
  mine?: boolean;
  answered?: boolean;
  onVote?: (choice: 0 | 1) => void;
  onAnswer?: () => void;
  /** Studio : les stickers ne réagissent pas (on les déplace). */
  editing?: boolean;
};

/** Le contenu d'un élément (sans sa position). */
export function OverlayContent({
  item,
  context,
}: {
  item: StoryOverlay;
  context: OverlayContext;
}) {
  const t = useTranslations("Community.stories.studio");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();

  switch (item.kind) {
    case "text":
      return <span style={textStyle(item)}>{item.text}</span>;
    case "emoji":
      return (
        <span aria-label={item.emoji} className="text-[16cqw] leading-none">
          {item.emoji}
        </span>
      );
    case "time":
      return (
        <span className={cn(CHIP, "font-display text-[7cqw] font-normal")}>
          {format.dateTime(context.createdAt, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      );
    case "date":
      return (
        <span
          className={cn(CHIP, "font-display text-[6cqw] font-normal uppercase")}
        >
          {format.dateTime(context.createdAt, {
            day: "numeric",
            month: "short",
          })}
        </span>
      );
    case "location":
      return (
        <span className={cn(CHIP, "text-[#c2410c] uppercase")}>
          <MapPin
            aria-hidden="true"
            className="size-[4.5cqw]"
            strokeWidth={2.5}
          />
          {item.text}
        </span>
      );
    case "hashtag":
      return <span className={cn(CHIP, "text-[#c2410c]")}>#{item.text}</span>;
    case "mention": {
      const label = `@${item.username ?? ""}`;
      return context.editing || !item.username ? (
        <span className={cn(CHIP, "text-[#c2410c]")}>{label}</span>
      ) : (
        <Link
          href={`/community/members/${item.username}`}
          className={cn(CHIP, "pointer-events-auto text-[#c2410c]")}
        >
          {label}
        </Link>
      );
    }
    case "streak":
      return (
        <span className={cn(CHIP, "bg-[#ff6b00] text-black")}>
          <Flame
            aria-hidden="true"
            className="size-[4.5cqw]"
            strokeWidth={2.5}
          />
          {item.title
            ? t("streakLabel", { title: item.title, days: item.days ?? 0 })
            : t("streak")}
        </span>
      );
    case "pillar": {
      const Icon = pillarIcons[item.pillar];
      return (
        <span className={CHIP}>
          <Icon aria-hidden="true" className="size-[4.5cqw] text-[#c2410c]" />
          {tPillars(`${item.pillar}.name`)}
        </span>
      );
    }
    case "music":
      return (
        <span className={cn(CHIP, "max-w-[70cqw]")}>
          <Music
            aria-hidden="true"
            className="size-[4.2cqw] shrink-0 text-[#c2410c]"
          />
          <span className="truncate">
            {context.music
              ? t("musicLabel", {
                  title: context.music.title,
                  artist: context.music.artist,
                })
              : t("music")}
          </span>
        </span>
      );
    case "poll":
      return <PollSticker item={item} context={context} />;
    case "question":
      return (
        <span className="flex w-[64cqw] flex-col overflow-hidden rounded-[4cqw] bg-white text-center shadow-[0_0.6cqw_2cqw_rgba(0,0,0,0.25)]">
          <span className="bg-[#ff6b00] px-[4cqw] py-[3cqw] text-[4.6cqw] font-bold break-words text-black">
            {item.prompt}
          </span>
          {context.editing || context.mine ? (
            <span className="px-[4cqw] py-[3cqw] text-[3.8cqw] text-neutral-500">
              {t("answerHere")}
            </span>
          ) : (
            <button
              type="button"
              onClick={context.onAnswer}
              disabled={context.answered}
              className="pointer-events-auto px-[4cqw] py-[3cqw] text-[3.8cqw] text-neutral-500 outline-none focus-visible:ring-3 focus-visible:ring-[#ff6b00]"
            >
              {context.answered ? t("answered") : t("answerHere")}
            </button>
          )}
        </span>
      );
  }
}

/** Sondage à deux options : on vote, puis les pourcentages s'affichent. */
function PollSticker({
  item,
  context,
}: {
  item: Extract<StoryOverlay, { kind: "poll" }>;
  context: OverlayContext;
}) {
  const t = useTranslations("Community.stories.studio");
  const poll = context.poll ?? null;
  const showResults = Boolean(context.mine || (poll && poll.mine !== null));
  const percents = pollPercents(poll?.counts ?? [0, 0]);
  return (
    <span className="flex w-[64cqw] flex-col gap-[2cqw] rounded-[4cqw] bg-white p-[3cqw] text-neutral-900 shadow-[0_0.6cqw_2cqw_rgba(0,0,0,0.25)]">
      <span className="px-[1cqw] text-center text-[4.6cqw] font-bold break-words">
        {item.question}
      </span>
      {item.options.map((option, index) => {
        const choice = index as 0 | 1;
        const picked = poll?.mine === choice;
        const content = (
          <>
            {showResults ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 rounded-[2.5cqw]",
                  picked ? "bg-[#ff6b00]/45" : "bg-neutral-300/70",
                )}
                style={{ width: `${percents[index]}%` }}
              />
            ) : null}
            <span className="relative truncate">{option}</span>
            {showResults ? (
              <span className="relative ml-auto tabular-nums">
                {t("percent", { value: percents[index] ?? 0 })}
              </span>
            ) : null}
          </>
        );
        const className =
          "relative flex items-center gap-[2cqw] overflow-hidden rounded-[2.5cqw] bg-neutral-100 px-[3cqw] py-[2.4cqw] text-[4.2cqw] font-semibold";
        return context.editing || showResults ? (
          <span key={index} className={className}>
            {content}
          </span>
        ) : (
          <button
            key={index}
            type="button"
            onClick={() => context.onVote?.(choice)}
            className={cn(
              className,
              "pointer-events-auto outline-none focus-visible:ring-3 focus-visible:ring-[#ff6b00]",
            )}
          >
            {content}
          </button>
        );
      })}
    </span>
  );
}

/** Les éléments d'une story posés sur le cadre (visionneuse). */
export function OverlayLayer({
  overlays,
  context,
}: {
  overlays: readonly StoryOverlay[];
  context: OverlayContext;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {overlays.map((item) => (
        <div key={item.id} className="absolute" style={overlayStyle(item)}>
          <OverlayContent item={item} context={context} />
        </div>
      ))}
    </div>
  );
}

/** Le cadre 9:16 d'une story : le média entier sur un fond flou, les éléments par-dessus. */
export function StoryFrame({
  kind,
  src,
  poster,
  children,
  className,
  videoRef,
  videoProps,
}: {
  kind: "image" | "video";
  src: string;
  poster?: string | null;
  children?: React.ReactNode;
  className?: string;
  videoRef?: React.Ref<HTMLVideoElement>;
  videoProps?: React.ComponentProps<"video">;
}) {
  const backdrop = kind === "image" ? src : (poster ?? null);
  return (
    <div
      className={cn(
        "[container-type:inline-size] relative aspect-[9/16] overflow-hidden rounded-2xl bg-neutral-900",
        className,
      )}
    >
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
        />
      ) : null}
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-contain"
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          playsInline
          className="absolute inset-0 size-full object-contain"
          {...videoProps}
        />
      )}
      {children}
    </div>
  );
}
