import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Nécessite app/[locale]/[...rest]/page.tsx pour les URL inconnues
export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center"
    >
      <p className="font-heading text-sm font-semibold tracking-widest text-primary">
        404
      </p>
      <h1 className="font-heading text-3xl font-bold tracking-tight">
        {t("title")}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("description")}</p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </main>
  );
}
