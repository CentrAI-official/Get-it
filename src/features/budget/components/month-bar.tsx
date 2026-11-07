import { cn } from "@/lib/utils";

/**
 * La barre du mois : où va chaque dollar qui entre. Dépensé, à venir (hachuré),
 * épargné, et le vide qui reste. Son résumé en mots est donné aux lecteurs d'écran ;
 * la légende, juste en dessous, porte les montants.
 */
export function MonthBar({
  spentCents,
  upcomingCents,
  savedCents,
  incomeCents,
  label,
}: {
  spentCents: number;
  upcomingCents: number;
  savedCents: number;
  incomeCents: number;
  label: string;
}) {
  const total = Math.max(
    incomeCents,
    spentCents + upcomingCents + savedCents,
    1,
  );
  const share = (cents: number) => (Math.max(cents, 0) / total) * 100;
  const segments = [
    { key: "spent", width: share(spentCents), className: "bg-primary" },
    { key: "upcoming", width: share(upcomingCents), className: "budget-hatch" },
    { key: "saved", width: share(savedCents), className: "bg-foreground" },
  ].filter((segment) => segment.width > 0);

  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-6 w-full gap-0.5 overflow-hidden rounded-lg bg-foreground/8"
    >
      {segments.map((segment) => (
        <span
          key={segment.key}
          style={{ width: `${Math.max(segment.width, 1)}%` }}
          className={cn(
            "h-full first:rounded-l-lg last:rounded-r-lg",
            segment.className,
          )}
        />
      ))}
    </div>
  );
}

/** Une pastille de la légende, comme le morceau de barre qu'elle nomme. */
export function BarSwatch({
  kind,
}: {
  kind: "spent" | "upcoming" | "saved" | "left";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3 shrink-0 rounded-[3px]",
        kind === "spent" && "bg-primary",
        kind === "upcoming" && "budget-hatch",
        kind === "saved" && "bg-foreground",
        kind === "left" && "bg-foreground/12",
      )}
    />
  );
}
