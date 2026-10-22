import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Action qui guide vers la suite (ex. « Créer mon premier objectif »). */
  action?: ReactNode;
  className?: string;
};

/** État vide qui explique quoi faire ensuite, plutôt qu'un simple « aucune donnée ». */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={cn("border-0 py-14", className)}>
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-2xl bg-primary/15 text-primary glow-primary [&_svg:not([class*='size-'])]:size-5"
        >
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="font-heading text-lg font-semibold">
          {title}
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
