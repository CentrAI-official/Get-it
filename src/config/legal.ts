// Les conditions d'utilisation et la politique de confidentialité (Loi 25) : la
// date de la version en vigueur. La changer quand le texte change de façon
// importante (les membres en sont prévenus dans l'application).
export const LEGAL_VERSION = "2026-11-13";

export const LEGAL_DOCUMENTS = ["privacy", "terms"] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];
