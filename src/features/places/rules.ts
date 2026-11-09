import { z } from "zod";

// Adresses proposées quand on tape un lieu (décision du fondateur, 2026-11-08 :
// Photon, d'après OpenStreetMap). La recherche passe par notre serveur : seul
// le texte tapé est envoyé, jamais le nom ni l'adresse IP de la personne.
// Fonctions pures, testées dans places.test.ts.

/** Lettres tapées avant de chercher, et au plus. */
export const PLACE_QUERY = { min: 3, max: 100 } as const;
/** Suggestions montrées. */
export const PLACE_RESULTS = 5;
/** Recherches par personne et par minute (en plus du délai entre deux lettres). */
export const PLACE_SEARCHES_PER_MINUTE = 40;

export const placeQuerySchema = z
  .string()
  .trim()
  .min(PLACE_QUERY.min)
  .max(PLACE_QUERY.max);

export type PlaceSuggestion = {
  /** Clé stable (OpenStreetMap). */
  id: string;
  /** Le nom du lieu, ou son adresse. */
  primary: string;
  /** Adresse, ville, province ou État, pays. */
  secondary: string;
  /** Ce qui est enregistré dans le champ « Lieu ». */
  label: string;
};

/** Ce que Photon renvoie pour un lieu (seulement ce qui sert). */
export const photonFeatureSchema = z.object({
  properties: z.object({
    osm_id: z.union([z.number(), z.string()]).optional(),
    osm_type: z.string().optional(),
    name: z.string().optional(),
    housenumber: z.string().optional(),
    street: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    countrycode: z.string().optional(),
  }),
});
export type PhotonFeature = z.infer<typeof photonFeatureSchema>;

/** Abréviations postales des provinces et territoires (adresses canadiennes). */
const PROVINCES: Record<string, string> = {
  Québec: "QC",
  Quebec: "QC",
  Ontario: "ON",
  "Nouveau-Brunswick": "NB",
  "New Brunswick": "NB",
  "Nouvelle-Écosse": "NS",
  "Nova Scotia": "NS",
  "Île-du-Prince-Édouard": "PE",
  "Prince Edward Island": "PE",
  "Terre-Neuve-et-Labrador": "NL",
  "Newfoundland and Labrador": "NL",
  Manitoba: "MB",
  Saskatchewan: "SK",
  Alberta: "AB",
  "Colombie-Britannique": "BC",
  "British Columbia": "BC",
  Yukon: "YT",
  "Territoires du Nord-Ouest": "NT",
  "Northwest Territories": "NT",
  Nunavut: "NU",
};

/** Libellé d'un lieu : son nom, puis l'adresse (« 1909 Avenue… »), la ville et la province. */
export function placeSuggestion(
  feature: PhotonFeature,
  maxLength: number,
): PlaceSuggestion | null {
  const p = feature.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ") || null;
  const city = p.city ?? p.district ?? null;
  const region =
    p.countrycode?.toUpperCase() === "CA" && p.state
      ? (PROVINCES[p.state] ?? p.state)
      : (p.state ?? null);
  const primary = p.name ?? street ?? city;
  if (!primary) return null;
  const rest = [
    p.name && street ? street : null,
    city && city !== primary ? city : null,
    [region, p.postcode].filter(Boolean).join(" ") || null,
    // Le pays seulement hors du Canada
    p.countrycode && p.countrycode.toUpperCase() !== "CA" ? p.country : null,
  ].filter((part): part is string => Boolean(part));
  const label = [primary, ...rest].join(", ").slice(0, maxLength).trim();
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? label}`,
    primary,
    secondary: rest.join(", "),
    label,
  };
}

/** Suggestions sans doublon (deux entrées d'OpenStreetMap pour le même endroit). */
export function placeSuggestions(
  features: readonly PhotonFeature[],
  maxLength: number,
): PlaceSuggestion[] {
  const seen = new Set<string>();
  const list: PlaceSuggestion[] = [];
  for (const feature of features) {
    const place = placeSuggestion(feature, maxLength);
    if (!place || seen.has(place.label.toLowerCase())) continue;
    seen.add(place.label.toLowerCase());
    list.push(place);
    if (list.length >= PLACE_RESULTS) break;
  }
  return list;
}

/** Ouvrir un lieu dans l'appli de cartes du téléphone (seulement au toucher). */
export function mapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
