import { cn } from "@/lib/utils";

/**
 * Le logo d'une page : un carré aux coins arrondis (une personne a un rond), ou
 * l'initiale de son nom.
 */
export function PageLogo({
  name,
  url,
  className,
}: {
  name: string;
  url: string | null;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={cn(
          "shrink-0 rounded-[22%] bg-foreground/5 object-cover",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[22%] bg-primary font-display text-primary-foreground uppercase",
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  );
}
