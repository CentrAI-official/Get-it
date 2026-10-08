import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** La question à laquelle la page répond (ex. « Que dois-je faire aujourd'hui? »). */
  description?: string;
  /** Action principale de la page (ex. « Nouvel objectif »). */
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
