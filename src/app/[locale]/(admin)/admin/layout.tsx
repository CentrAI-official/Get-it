import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdminSurface } from "@/server/admin/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.metadata");
  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    // Jamais indexé : réservé à l'équipe
    robots: { index: false, follow: false },
  };
}

/**
 * Application admin : n'existe que sur son propre déploiement (APP_SURFACE=admin).
 * Sur l'application des membres, /admin est introuvable.
 */
export default function AdminLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  if (!isAdminSurface()) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-app"
      />
      {children}
    </div>
  );
}
