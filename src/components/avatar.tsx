import { cn } from "@/lib/utils";

type AvatarProps = {
  /** Nom affiché : son initiale sert quand il n'y a pas de photo. */
  name: string;
  /** Lien de la photo de profil, ou null. */
  url: string | null | undefined;
  /** Taille et typographie (ex. « size-10 », « size-20 text-2xl »). */
  className?: string;
};

/**
 * Photo de profil, ou l'initiale dans une bulle. Décorative : le nom est
 * toujours écrit à côté.
 */
export function Avatar({ name, url, className }: AvatarProps) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={cn(
          "shrink-0 rounded-full bg-white/5 object-cover",
          className,
        )}
      />
    );
  }
  return (
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
}
