import { HeartHandshake, MessageSquare, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Montré au lieu d'un plan quand Get iT AI détecte une détresse : des
 * ressources d'aide immédiate, sans jugement.
 */
export function CrisisResources({ onBack }: { onBack: () => void }) {
  const t = useTranslations("Development.crisis");

  return (
    <section
      role="alert"
      aria-labelledby="crisis-title"
      className="flex max-w-2xl flex-col gap-5"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <HeartHandshake aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 id="crisis-title" className="font-heading text-xl font-bold">
          {t("title")}
        </h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg">
          <a href="tel:988">
            <Phone aria-hidden="true" />
            {t("call988")}
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="sms:988">
            <MessageSquare aria-hidden="true" />
            {t("text988")}
          </a>
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li>{t("info811")}</li>
        <li>{t("emergency")}</li>
      </ul>
      <Button variant="ghost" className="w-fit" onClick={onBack}>
        {t("back")}
      </Button>
    </section>
  );
}
