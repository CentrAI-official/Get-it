import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Nom ou photo d'un membre : mène à son profil (ou à la page pro qui parle).
 * Sans nom d'utilisateur (pas encore membre du Centre), le contenu reste du
 * simple texte.
 */
export function ProfileLink({
  username,
  pageHandle,
  className,
  children,
  onClick,
}: {
  username: string | null | undefined;
  /** Au nom d'une page pro : mène à sa page. */
  pageHandle?: string | null;
  className?: string;
  children: ReactNode;
  /** Avant d'ouvrir le profil (ex. fermer la visionneuse des stories). */
  onClick?: () => void;
}) {
  const href = pageHandle
    ? `/pages/${pageHandle}`
    : username
      ? `/community/members/${username}`
      : null;
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link
      href={href}
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
