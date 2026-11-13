import type { Locale } from "next-intl";
import type { LegalDocument } from "@/config/legal";
import en from "./en.json";
import fr from "./fr.json";

// Le texte de la politique de confidentialité et des conditions d'utilisation,
// à part des messages de l'interface (trop long pour leurs types). Les deux
// langues ont la même forme : un test le vérifie.

export type LegalSection = { title: string; paragraphs: string[] };

export type LegalText = {
  title: string;
  intro: string;
  /** Politique : la personne responsable ({name}, {email}). */
  officer?: string;
  /** Conditions : l'adresse pour une question ({email}). */
  contact?: string;
  sections: LegalSection[];
};

const TEXTS: Record<Locale, Record<LegalDocument, LegalText>> = { fr, en };

export function legalText(locale: Locale, kind: LegalDocument): LegalText {
  return TEXTS[locale][kind];
}

/** Remplace {name} et {email} (pas de format ICU dans ces textes). */
export function fillLegal(text: string, values: Record<string, string>) {
  return text.replace(
    /\{(\w+)\}/g,
    (match, key: string) => values[key] ?? match,
  );
}
