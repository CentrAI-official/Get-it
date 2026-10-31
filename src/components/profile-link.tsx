import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Nom ou photo d'un membre : mène à son profil. Sans nom d'utilisateur (pas
 * encore membre du Centre), le contenu reste du simple texte.
 */
export function ProfileLink({
  username,
  className,
  children,
  onClick,
}: {
  username: string | null | undefined;
  className?: string;
  children: ReactNode;
  /** Avant d'ouvrir le profil (ex. fermer la visionneuse des stories). */
  onClick?: () => void;
}) {
  if (!username) return <span className={className}>{children}</span>;
  return (
    <Link
      href={`/community/members/${username}`}
      onClick={onClick}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {children}
    </Link>
  );
}
