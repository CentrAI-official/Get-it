import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocumentPage } from "@/features/legal/components/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal.terms");
  return { title: t("metaTitle") };
}

// Loi 25 : introuvable tant que la personne responsable n'est pas configurée
export default function Page() {
  return <LegalDocumentPage kind="terms" />;
}
