import { cn } from "@/lib/utils";

type AvatarProps = {
  /** Nom affiché : son initiale sert quand il n'y a pas de photo. */
  name: string;
  /** Lien de la photo de profil, ou null. */
  url: string | null | undefined;
  /** Taille et typographie (ex. « size-10 », « size-20 text-2xl »). */
  className?: string;
  /** Contact en ligne : un petit rond orange en bas à droite (le texte « En ligne » est donné à côté). */
  online?: boolean;
};

/**
 * Photo de profil, ou l'initiale dans une bulle. Décorative : le nom est
 * toujours écrit à côté.
 */
export function Avatar({ name, url, className, online }: AvatarProps) {
  const face = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={cn(
        "shrink-0 rounded-full bg-foreground/5 object-cover",
        className,
      )}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full orb font-heading font-bold uppercase",
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  );
  if (!online) return face;
  return (
    <span className="relative inline-flex shrink-0">
      {face}
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-0 size-[28%] min-h-2.5 min-w-2.5 rounded-full bg-primary ring-2 ring-background"
      />
    </span>
  );
}
