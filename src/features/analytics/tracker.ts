import { useEffect } from "react";
import type { AnalyticsClientEvent } from "./events";
import {
  FLUSH_MS,
  IDLE_MS,
  MAX_BATCH,
  MAX_SLICE_MS,
  SESSION_GAP_MS,
} from "./rules";
import type { OverlaySection } from "./sections";

// Mesure du temps actif dans le navigateur (composants client seulement). Une
// seconde compte si l'onglet est visible et que la personne a touché, tapé ou
// défilé dans la dernière minute (ou qu'une vidéo joue). Le temps est attribué
// à la page affichée, ou à la fenêtre ouverte par-dessus (« Ma journée »,
// stories), puis envoyé par lots toutes les 30 secondes et quand on quitte.

const ENDPOINT = "/api/v1/analytics/events";
const SESSION_KEY = "getit.analytics.session";
const TICK_MS = 1_000;

const queue: AnalyticsClientEvent[] = [];
let currentPath: string | null = null;
/** Fenêtres ouvertes, la dernière par-dessus les autres. */
const overlays: OverlaySection[] = [];
/** Temps actif accumulé pour la page ou la fenêtre courante. */
let sliceMs = 0;
let lastTick = 0;
let lastInput = 0;
let fallbackSession: { id: string; last: number } | null = null;

function newSession(now: number) {
  return { id: crypto.randomUUID(), last: now };
}

/** Session de navigation : nouvelle après 30 minutes sans activité. */
function sessionId(now: number): string {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) ?? "null",
    ) as { id?: unknown; last?: unknown } | null;
    const session =
      typeof stored?.id === "string" &&
      typeof stored.last === "number" &&
      now - stored.last < SESSION_GAP_MS
        ? { id: stored.id, last: now }
        : newSession(now);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session.id;
  } catch {
    // Stockage indisponible (navigation privée) : session gardée en mémoire
    fallbackSession =
      fallbackSession && now - fallbackSession.last < SESSION_GAP_MS
        ? { ...fallbackSession, last: now }
        : newSession(now);
    return fallbackSession.id;
  }
}

function push(event: AnalyticsClientEvent) {
  queue.push(event);
  if (queue.length >= MAX_BATCH) flush();
}

/** Envoie la tranche de temps actif de la page ou de la fenêtre courante. */
function closeSlice(now = Date.now()) {
  const durationMs = Math.min(Math.round(sliceMs), MAX_SLICE_MS);
  sliceMs = 0;
  if (durationMs < 1_000) return;
  const overlay = overlays.at(-1);
  if (!overlay && !currentPath) return;
  push({
    name: "time",
    sessionId: sessionId(now),
    at: now,
    durationMs,
    ...(overlay ? { overlay } : { path: currentPath ?? "/" }),
  });
}

function flush(useBeacon = false) {
  while (queue.length > 0) {
    const body = JSON.stringify({ events: queue.splice(0, MAX_BATCH) });
    try {
      if (
        useBeacon &&
        navigator.sendBeacon(
          ENDPOINT,
          new Blob([body], { type: "application/json" }),
        )
      ) {
        continue;
      }
      void fetch(ENDPOINT, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // La mesure ne doit jamais gêner l'application
    }
  }
}

function videoPlaying() {
  return Array.from(document.querySelectorAll("video")).some(
    (video) => !video.paused && !video.ended,
  );
}

function tick() {
  const now = Date.now();
  // Un onglet endormi ne rattrape pas le temps perdu
  const delta = Math.min(now - lastTick, 2 * TICK_MS);
  lastTick = now;
  if (document.visibilityState !== "visible") return;
  if (now - lastInput >= IDLE_MS && !videoPlaying()) return;
  sliceMs += delta;
  if (sliceMs >= FLUSH_MS) closeSlice(now);
}

const markInput = () => {
  lastInput = Date.now();
};

function onHide() {
  if (document.visibilityState === "visible") return;
  closeSlice();
  flush(true);
}

const INPUT_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

/** Démarre la mesure ; renvoie la fonction qui l'arrête (et envoie ce qui reste). */
export function startTracking() {
  lastTick = Date.now();
  lastInput = lastTick;
  const ticker = window.setInterval(tick, TICK_MS);
  const sender = window.setInterval(() => flush(), FLUSH_MS);
  for (const type of INPUT_EVENTS) {
    window.addEventListener(type, markInput, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  return () => {
    window.clearInterval(ticker);
    window.clearInterval(sender);
    for (const type of INPUT_EVENTS) {
      window.removeEventListener(type, markInput, { capture: true });
    }
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    closeSlice();
    flush(true);
  };
}

/** Nouvelle page affichée : le temps accumulé revient à la précédente. */
export function setTrackedPath(pathname: string) {
  if (pathname === currentPath) return;
  closeSlice();
  currentPath = pathname;
}

/** Fenêtre ouverte par-dessus la page ; renvoie la fonction qui la referme. */
function openOverlay(overlay: OverlaySection) {
  closeSlice();
  overlays.push(overlay);
  const now = Date.now();
  push({ name: "open", sessionId: sessionId(now), at: now, overlay });
  return () => {
    closeSlice();
    const index = overlays.lastIndexOf(overlay);
    if (index >= 0) overlays.splice(index, 1);
  };
}

/** Mesure le temps passé dans une fenêtre tant qu'elle est ouverte. */
export function useTrackedOverlay(overlay: OverlaySection, open: boolean) {
  useEffect(() => (open ? openOverlay(overlay) : undefined), [overlay, open]);
}
