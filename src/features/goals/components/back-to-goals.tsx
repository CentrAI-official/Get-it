import { useTranslations } from "next-intl";
import { BackLink } from "@/components/back-link";

/** Lien de retour vers la liste des objectifs. */
export function BackToGoals() {
  const t = useTranslations("Goals");
  return <BackLink href="/goals" label={t("backToList")} />;
}
