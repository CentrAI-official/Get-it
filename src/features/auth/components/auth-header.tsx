type AuthHeaderProps = {
  title: string;
  description: string;
};

export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
