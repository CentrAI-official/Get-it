import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Lien de retour vers la liste des objectifs. */
export function BackToGoals({ href = "/goals" }: { href?: string }) {
  const t = useTranslations("Goals");

  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t("backToList")}
    </Link>
  );
}
