import { useTranslations } from "next-intl";
import { BackLink } from "@/components/back-link";

/** Retour à la fiche du client. */
export function BackToClient({ clientId }: { clientId: string }) {
  const t = useTranslations("Clients.file");
  return <BackLink href={`/clients/${clientId}`} label={t("title")} />;
}
