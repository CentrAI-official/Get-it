import "server-only";
import { z } from "zod";
import {
  PLACE_RESULTS,
  PLACE_SEARCHES_PER_MINUTE,
  photonFeatureSchema,
  placeSuggestions,
  type PlaceSuggestion,
} from "@/features/places/rules";
import { siteConfig } from "@/config/site";

// Recherche d'adresses (décision du fondateur, 2026-11-08) : Photon, service
// gratuit d'après OpenStreetMap, appelé par notre serveur. Seul le texte tapé
// part, sans nom, sans adresse IP de la personne ni témoin. Usage raisonnable :
// délai entre deux lettres dans le navigateur, limite par personne et cache
// d'une heure ici. À remplacer par un fournisseur payant si l'app grandit
// beaucoup (une seule fonction à changer).

const PHOTON_URL = "https://photon.komoot.io/api/";
/** Les adresses du Québec d'abord (centre de la province). */
const BIAS = { lat: 46.8, lon: -71.2 };
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;

const cache = new Map<string, { at: number; places: PlaceSuggestion[] }>();
const recent = new Map<string, number[]>();

const responseSchema = z.object({ features: z.array(z.unknown()) });

/** Sous la limite de recherches de la minute (gardée en mémoire du serveur). */
function allowed(userId: string) {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((at) => now - at < 60_000);
  if (times.length >= PLACE_SEARCHES_PER_MINUTE) return false;
  times.push(now);
  recent.set(userId, times);
  return true;
}

/**
 * Adresses qui correspondent à `query`, dans la langue de la personne ; une
 * liste vide si le service ne répond pas (le champ reste un texte libre).
 */
export async function searchPlaces(
  userId: string,
  query: string,
  locale: "fr" | "en",
  maxLength: number,
): Promise<PlaceSuggestion[]> {
  const key = `${locale}:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.places;
  if (!allowed(userId)) return [];

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("lang", locale);
  url.searchParams.set("limit", String(PLACE_RESULTS * 2));
  url.searchParams.set("lat", String(BIAS.lat));
  url.searchParams.set("lon", String(BIAS.lon));
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": `${siteConfig.name} (${siteConfig.url})` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const body = responseSchema.safeParse(await response.json());
    if (!body.success) return [];
    const features = body.data.features.flatMap((feature) => {
      const parsed = photonFeatureSchema.safeParse(feature);
      return parsed.success ? [parsed.data] : [];
    });
    const places = placeSuggestions(features, maxLength);
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), places });
    return places;
  } catch {
    return [];
  }
}
