import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", href: "/profile" },
  { key: "goals", href: "/goals" },
  { key: "habits", href: "/habits" },
] as const;

export type ProfileTab = (typeof TABS)[number]["key"];

/** Sections de l'onglet Profil : aperçu, objectifs et habitudes. */
export function ProfileTabs({ current }: { current: ProfileTab }) {
  const t = useTranslations("App.profileTabs");

  return (
    <nav aria-label={t("label")} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max gap-2">
        {TABS.map(({ key, href }) => (
          <li key={key}>
            <Link
              href={href}
              aria-current={key === current ? "page" : undefined}
              className={cn(
                "flex rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                key === current
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
