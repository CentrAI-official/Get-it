type PageHeaderProps = {
  title: string;
  /** La question à laquelle la page répond (ex. « Que dois-je faire aujourd'hui? »). */
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
