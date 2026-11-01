import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";

/** Connexion de l'équipe : une colonne centrée, la marque et l'avis du journal des accès. */
export default function AdminAccessLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  const t = useTranslations("Admin");

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12"
    >
      <div className="flex items-baseline gap-3">
        <Logo className="text-4xl" />
        <span className="caps-label text-muted-foreground">{t("badge")}</span>
      </div>
      {children}
      <p className="flex gap-2 text-xs text-pretty text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
        {t("access.notice")}
      </p>
    </main>
  );
}
