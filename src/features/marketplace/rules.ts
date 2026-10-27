import { z } from "zod";
import { PILLARS } from "@/config/pillars";
import { postMediaSchema } from "@/features/community/media";

// Marketplace : annonces de services (professionnels) et de gear (produits),
// proposées par les comptes affiliés et approuvées par l'équipe Get iT avant
// d'être visibles. Les listes ci-dessous sont aussi vérifiées par la base
// (contraintes de la migration « marketplace ») : les garder alignées.

export const ACCOUNT_TYPES = ["consumer", "affiliate"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const LISTING_KINDS = ["service", "gear"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

/** Types de services ; les sous-branches viendront plus tard. */
export const SERVICE_CATEGORIES = [
  "fitness_coach",
  "nutritionist",
  "financial_advisor",
  "psychologist",
  "other",
] as const;
export const GEAR_CATEGORIES = [
  "clothing",
  "equipment",
  "books",
  "other",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export type GearCategory = (typeof GEAR_CATEGORIES)[number];
export type ListingCategory = ServiceCategory | GearCategory;

/** Professions encadrées par un ordre ou l'AMF : numéro de permis obligatoire. */
export const REGULATED_CATEGORIES: readonly ServiceCategory[] = [
  "nutritionist",
  "financial_advisor",
  "psychologist",
];

export const SERVICE_PRICE_UNITS = [
  "session",
  "hour",
  "month",
  "package",
] as const;
export type ServicePriceUnit = (typeof SERVICE_PRICE_UNITS)[number];
/** Le gear a un prix fixe, à l'unité. */
export const GEAR_PRICE_UNIT = "item";
export type PriceUnit = ServicePriceUnit | typeof GEAR_PRICE_UNIT;

/** Les 17 régions administratives du Québec, plus les services à distance. */
export const REGIONS = [
  "online",
  "bas_saint_laurent",
  "saguenay_lac_saint_jean",
  "capitale_nationale",
  "mauricie",
  "estrie",
  "montreal",
  "outaouais",
  "abitibi_temiscamingue",
  "cote_nord",
  "nord_du_quebec",
  "gaspesie_iles_de_la_madeleine",
  "chaudiere_appalaches",
  "laval",
  "lanaudiere",
  "laurentides",
  "monteregie",
  "centre_du_quebec",
] as const;
export type Region = (typeof REGIONS)[number];

/** Tranches du filtre de prix, en cents (borne haute exclue ; null : sans limite). */
export const PRICE_RANGES = [
  { key: "under50", min: 0, max: 5_000 },
  { key: "from50", min: 5_000, max: 10_000 },
  { key: "from100", min: 10_000, max: 20_000 },
  { key: "over200", min: 20_000, max: null },
] as const;
export const PRICE_RANGE_KEYS = [
  "under50",
  "from50",
  "from100",
  "over200",
] as const;
export type PriceRangeKey = (typeof PRICE_RANGE_KEYS)[number];

export const LISTING_TITLE_MAX = 80;
export const LISTING_SUMMARY_MAX = 160;
export const LISTING_DESCRIPTION_MAX = 3000;
export const CONTACT_NAME_MAX = 100;
export const URL_MAX = 300;
export const LICENSE_MAX = 50;
/** Prix le plus élevé accepté : 100 000 $. */
export const PRICE_MAX_CENTS = 10_000_000;
/** Annonces en attente ou en ligne par affilié. */
export const MAX_ACTIVE_LISTINGS = 20;
/** Annonces soumises par 24 heures (anti-spam). */
export const DAILY_LISTINGS = 5;
/** Annonces par page du catalogue. */
export const CATALOG_PAGE_SIZE = 20;

/** Vrai si une annonce (prix ou fourchette) touche la tranche choisie. */
export function inPriceRange(
  price: { minCents: number; maxCents: number | null },
  range: { min: number; max: number | null },
) {
  const top = price.maxCents ?? price.minCents;
  return (range.max === null || price.minCents < range.max) && top >= range.min;
}

/** Montant saisi en dollars (« 80 », « 79,99 ») vers des cents. */
export function dollarsToCents(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents <= PRICE_MAX_CENTS ? cents : null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalUrl = z
  .string()
  .trim()
  .max(URL_MAX)
  .transform((value, ctx) => {
    if (!value) return null;
    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;
    const parsed = z
      .url({ protocol: /^https?$/, hostname: z.regexes.domain })
      .safeParse(withProtocol);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: "url" });
      return z.NEVER;
    }
    return parsed.data;
  });

const money = z.string().transform((value, ctx) => {
  const cents = dollarsToCents(value);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "price" });
    return z.NEVER;
  }
  return cents;
});

const common = {
  title: z.string().trim().min(3).max(LISTING_TITLE_MAX),
  summary: z.string().trim().min(10).max(LISTING_SUMMARY_MAX),
  description: z.string().trim().min(20).max(LISTING_DESCRIPTION_MAX),
  pillar: z.enum(PILLARS),
  contactName: z.string().trim().min(2).max(CONTACT_NAME_MAX),
  contactEmail: z.email().max(254),
  website: optionalUrl,
  socialUrl: optionalUrl,
  media: postMediaSchema.refine(
    (items) => items.every((item) => !item.durationMs && !item.posterUploadId),
    { error: "mediaType" },
  ),
};

/** Formulaire « Vendre » : revalidé par le serveur avant tout enregistrement. */
export const listingInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("service"),
      ...common,
      category: z.enum(SERVICE_CATEGORIES),
      priceMin: money,
      priceMax: z
        .string()
        .transform((value) => value.trim())
        .pipe(z.union([z.literal(""), money]))
        .transform((value) => (value === "" ? null : value)),
      priceUnit: z.enum(SERVICE_PRICE_UNITS),
      regions: z
        .array(z.enum(REGIONS))
        .min(1)
        .refine((list) => new Set(list).size === list.length),
      licenseNumber: optionalText(LICENSE_MAX),
    })
    .refine(
      (data) => data.priceMax === null || data.priceMax >= data.priceMin,
      {
        path: ["priceMax"],
        error: "priceOrder",
      },
    )
    .refine(
      (data) =>
        !REGULATED_CATEGORIES.includes(data.category) ||
        data.licenseNumber !== null,
      { path: ["licenseNumber"], error: "licenseRequired" },
    ),
  z.object({
    kind: z.literal("gear"),
    ...common,
    category: z.enum(GEAR_CATEGORIES),
    priceMin: money,
  }),
]);

export type ListingInput = z.infer<typeof listingInputSchema>;

/** Filtres du catalogue, lus dans l'adresse (valeurs inconnues ignorées). */
/** Où se donne un service : en ligne ou en présentiel (sans choix : les deux). */
export const SERVICE_MODES = ["online", "in_person"] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];
/** Régions où l'on se rencontre en personne (toutes sauf « en ligne »). */
export const IN_PERSON_REGIONS = REGIONS.filter(
  (region) => region !== "online",
);

/** Longueur d'une recherche (« Que veux-tu accomplir? »). */
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 60;

export const catalogFiltersSchema = z.object({
  pillar: z.enum(PILLARS).optional().catch(undefined),
  mode: z.enum(SERVICE_MODES).optional().catch(undefined),
  region: z.enum(REGIONS).optional().catch(undefined),
  price: z.enum(PRICE_RANGE_KEYS).optional().catch(undefined),
  category: z
    .enum([...SERVICE_CATEGORIES, ...GEAR_CATEGORIES])
    .optional()
    .catch(undefined),
  /** Recherche dans le titre et le résumé ; trop courte ou trop longue : ignorée. */
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH)
    .max(SEARCH_MAX_LENGTH)
    .optional()
    .catch(undefined),
  /** « Tout voir » : la liste complète plutôt que la vitrine. */
  view: z.literal("list").optional().catch(undefined),
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

/** Vrai quand la page montre une liste filtrée plutôt que la vitrine. */
export function isFiltered(filters: CatalogFilters) {
  return Object.values(filters).some((value) => value !== undefined);
}

/** Catégories de la rangée d'icônes de la vitrine (« Autre » reste dans « Tout »). */
export const VITRINE_CATEGORIES = {
  service: [
    "fitness_coach",
    "nutritionist",
    "financial_advisor",
    "psychologist",
  ],
  gear: ["clothing", "equipment", "books"],
} as const satisfies Record<ListingKind, readonly ListingCategory[]>;

/** Annonces par collection de la vitrine, et collections « Pour ton plan » au plus. */
export const VITRINE_COLLECTION_SIZE = 8;
export const VITRINE_PLAN_COLLECTIONS = 2;

/** Favoris gardés au plus par personne. */
export const FAVORITES_MAX = 200;

/**
 * Vente de gear : fermée pour l'instant (décision du fondateur, 2026-10-26).
 * L'onglet Gear annonce « bientôt » ; les annonces gear existantes restent en
 * base, masquées.
 */
export const GEAR_SALES_OPEN = false;

export const MARKETPLACE_ERRORS = [
  "notAffiliate",
  "gearSoon",
  "notJoined",
  "suspended",
  "listingLimit",
  "dailyLimit",
  "invalid",
  "mediaUnavailable",
  "mediaMissing",
  "mediaTooMany",
  "mediaType",
  "mediaTooLarge",
  "uploadLimit",
  "notFound",
  "unexpected",
] as const;

export type MarketplaceError = (typeof MARKETPLACE_ERRORS)[number];
