import { z } from "zod";
import { REGIONS, SERVICE_CATEGORIES } from "@/features/marketplace/rules";
import { fieldErrorsFrom } from "@/lib/form-errors";

// Pages pro (décision du fondateur, 2026-11-07) : comme une page Facebook, la
// page d'une personne qui vend des services, séparée de son compte personnel.
// Tout membre peut en créer une ; une seule par personne pour commencer.
// Limites alignées sur la migration 20261119120000_pages (un test le vérifie).
// Fonctions pures.

export const PAGE_LIMITS = {
  nameMin: 2,
  name: 60,
  about: 600,
  website: 200,
  handleMin: 3,
  handleMax: 30,
} as const;

/** Adresse d'une page : minuscules, chiffres, « . », « - » et « _ », sans les commencer ni les finir. */
export const HANDLE_PATTERN = /^[a-z0-9]([a-z0-9._-]{1,28})[a-z0-9]$/;

/** Adresses qui prêteraient à confusion avec Get iT ou ses pages. */
const RESERVED_HANDLES = new Set([
  "new",
  "edit",
  "pro",
  "admin",
  "getit",
  "get-it",
  "get.it",
  "get_it",
  "support",
  "staff",
  "officiel",
  "official",
  "moderation",
]);

export const PAGE_ERRORS = [
  "nameRequired",
  "nameTooLong",
  "handleInvalid",
  "handleReserved",
  "handleTaken",
  "categoryRequired",
  "aboutTooLong",
  "websiteInvalid",
  "regionsInvalid",
  "notJoined",
  "suspended",
  "alreadyHasPage",
  "notFound",
  "unexpected",
] as const;
export type PageError = (typeof PAGE_ERRORS)[number];

export function isPageError(value: unknown): value is PageError {
  return PAGE_ERRORS.includes(value as PageError);
}

/** Une adresse proposée à partir du nom : « Coach Max Énergie » → « coach-max-energie ». */
export function handleFromName(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PAGE_LIMITS.handleMax)
    .replace(/-+$/g, "");
  return slug.length >= PAGE_LIMITS.handleMin ? slug : "";
}

export const isValidHandle = (handle: string) =>
  HANDLE_PATTERN.test(handle) && !RESERVED_HANDLES.has(handle);

const error = (key: PageError) => ({ error: key });

const PAGE_FIELDS = [
  "name",
  "handle",
  "category",
  "about",
  "regions",
  "website",
] as const;
export type PageField = (typeof PAGE_FIELDS)[number];

/** Formulaire d'une page : son nom, son adresse, son domaine et sa présentation. */
export const pageFormSchema = z.object({
  name: z
    .string(error("nameRequired"))
    .trim()
    .min(PAGE_LIMITS.nameMin, error("nameRequired"))
    .max(PAGE_LIMITS.name, error("nameTooLong")),
  handle: z
    .string(error("handleInvalid"))
    .trim()
    .toLowerCase()
    .refine((value) => HANDLE_PATTERN.test(value), error("handleInvalid"))
    .refine((value) => !RESERVED_HANDLES.has(value), error("handleReserved")),
  category: z.enum(SERVICE_CATEGORIES, error("categoryRequired")),
  about: z
    .string()
    .trim()
    .max(PAGE_LIMITS.about, error("aboutTooLong"))
    .optional()
    .default(""),
  regions: z
    .array(z.enum(REGIONS, error("regionsInvalid")))
    .optional()
    .default([])
    .transform((values) => [...new Set(values)]),
  website: z
    .string()
    .trim()
    .max(PAGE_LIMITS.website, error("websiteInvalid"))
    .optional()
    .transform((value) => value || null)
    .refine(
      (value) => value === null || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(value),
      error("websiteInvalid"),
    ),
});
export type PageInput = z.output<typeof pageFormSchema>;

export function pageFieldErrors(zodError: z.ZodError) {
  return fieldErrorsFrom(zodError, PAGE_FIELDS, isPageError, "unexpected");
}

/** Ce qui manque encore pour qu'une page inspire confiance, dans l'ordre. */
export function pageCompletion(page: {
  logoUrl: string | null;
  coverUrl: string | null;
  about: string;
  services: number;
}) {
  const steps = [
    { key: "logo", done: page.logoUrl !== null },
    { key: "cover", done: page.coverUrl !== null },
    { key: "about", done: page.about.trim().length > 0 },
    { key: "service", done: page.services > 0 },
  ] as const;
  return { steps, done: steps.filter((step) => step.done).length };
}
