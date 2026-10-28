type AuthHeaderProps = {
  title: string;
  description: string;
};

export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-4xl leading-[0.95] text-balance uppercase">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
