import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Pièces du dashboard de l'équipe. Contrairement à l'application des membres
// (sans encadrés), le dashboard range ses chiffres dans des cartes, avec des
// icônes et des courbes (décision du fondateur, 2026-10-31). Une seule couleur
// de détail : l'orange, pour ce qui monte, ce qui est choisi et les données.

/** Carte qui répond à une question (« Est-ce que les nouveaux reviennent? »). */
export function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-3xl border border-foreground/6 bg-raised p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg leading-snug font-semibold text-balance">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Pastille d'icône, en orange pâle. */
export function IconChip({
  icon: Icon,
  size = "md",
}: {
  icon: LucideIcon;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary",
        size === "sm" ? "size-8" : "size-10",
      )}
    >
      <Icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

/**
 * Évolution par rapport à la période précédente : flèche orange quand ça monte
 * (de la progression), grise quand ça baisse ; le texte reste à l'encre du thème.
 */
export function Change({
  change,
  label,
}: {
  /** Signée et déjà formatée (« +12 % ») ; null sans point de comparaison. */
  change: { value: number; text: string } | null;
  /** « vs les 30 jours d'avant ». */
  label: string;
}) {
  if (!change) return null;
  const up = change.value > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      {change.value === 0 ? null : (
        <Arrow
          aria-hidden="true"
          className={cn(
            "size-3.5",
            up ? "text-primary" : "text-muted-foreground",
          )}
        />
      )}
      <span className="font-medium text-foreground">{change.text}</span>
      <span>{label}</span>
    </p>
  );
}

/** Petite courbe d'une série par jour (décorative : les chiffres sont écrits à côté). */
export function Sparkline({ values }: { values: readonly number[] }) {
  // Rien à montrer : pas de courbe plate
  if (values.length < 2 || values.every((value) => value === 0)) return null;
  const max = Math.max(1, ...values);
  const step = 100 / (values.length - 1);
  const points = values.map(
    (value, index) => `${index * step},${30 - (value / max) * 26}`,
  );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-8 w-14 shrink-0 text-primary sm:w-24"
    >
      <polygon
        points={`0,32 ${points.join(" ")} 100,32`}
        className="fill-current opacity-10"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export type KpiProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  change?: { value: number; text: string } | null;
  changeLabel?: string;
  trend?: readonly number[];
};

/** Chiffre clé : icône, valeur, évolution et petite courbe. */
export function KpiTile({
  icon,
  label,
  value,
  hint,
  change,
  changeLabel,
  trend,
}: KpiProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-foreground/6 bg-raised p-4">
      <div className="flex items-center gap-2.5">
        <IconChip icon={icon} size="sm" />
        <p className="text-sm leading-tight text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-3xl leading-none sm:text-4xl">
          {value}
        </p>
        {trend ? <Sparkline values={trend} /> : null}
      </div>
      {change && changeLabel ? (
        <Change change={change} label={changeLabel} />
      ) : hint ? (
        <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export type RankRow = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Chiffre principal, à droite. */
  value: string;
  /** Longueur de la barre, de 0 à 1. */
  ratio: number;
  /** Chiffres secondaires, sous la barre. */
  details?: readonly string[];
  /** Ligne grisée (ex. fonction jamais utilisée). */
  muted?: boolean;
};

/** Classement : une ligne par élément, une barre orange proportionnelle. */
export function RankList({
  rows,
  label,
}: {
  rows: readonly RankRow[];
  label: string;
}) {
  return (
    <ol aria-label={label} className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3">
          {row.icon ? <IconChip icon={row.icon} size="sm" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "min-w-0 truncate text-sm",
                  row.muted ? "text-muted-foreground" : "font-medium",
                )}
              >
                {row.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {row.value}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="h-1.5 overflow-hidden rounded-full bg-foreground/6"
            >
              <div
                className="h-full rounded-full bg-chart-1"
                style={{
                  width: `${Math.max(0, Math.min(1, row.ratio)) * 100}%`,
                }}
              />
            </div>
            {row.details && row.details.length > 0 ? (
              <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {row.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Message d'une carte sans données : ce qui manque et quand ça arrivera. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-foreground/[0.03] px-4 py-6 text-center text-sm text-pretty text-muted-foreground">
      {children}
    </p>
  );
}

/** Chargement d'une page du dashboard. */
export function AdminPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-56 rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}

/** Une part d'un total (ex. membres qui ont activé un réglage). */
export function Meter({
  label,
  value,
  ratio,
  detail,
}: {
  label: string;
  value: string;
  ratio: number;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-2xl font-semibold">{value}</span>
      </div>
      <div
        aria-hidden="true"
        className="h-2.5 overflow-hidden rounded-full bg-primary/12"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
