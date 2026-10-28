import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SectionTab = { key: string; href: `/${string}`; label: string };

type SectionTabsProps = {
  /** Nom accessible de la navigation (ex. « Sections du profil »). */
  label: string;
  tabs: readonly SectionTab[];
  current: string;
};

/** Sous-onglets d'une catégorie (Profil, Marketplace), en pastilles défilantes. */
export function SectionTabs({ label, tabs, current }: SectionTabsProps) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max gap-2">
        {tabs.map(({ key, href, label: tabLabel }) => (
          <li key={key}>
            <Link
              href={href}
              aria-current={key === current ? "page" : undefined}
              className={cn(
                "flex rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                key === current
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {tabLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
