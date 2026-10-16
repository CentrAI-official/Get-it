import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "./page-header";

type ComingSoonProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  soonTitle: string;
  soonDescription: string;
  /** Sous-onglets de la catégorie, au-dessus du titre. */
  tabs?: ReactNode;
  /** Action qui mène vers ce qui existe déjà (ex. « Magasiner des services »). */
  action?: ReactNode;
};

/** Page d'une section en construction : titre, puis ce qui arrive bientôt. */
export function ComingSoon({
  title,
  description,
  icon,
  soonTitle,
  soonDescription,
  tabs,
  action,
}: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {tabs}
        <PageHeader title={title} description={description} />
      </div>
      <EmptyState
        icon={icon}
        title={soonTitle}
        description={soonDescription}
        action={action}
      />
    </div>
  );
}
