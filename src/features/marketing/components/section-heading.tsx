type SectionHeadingProps = {
  id: string;
  title: string;
  subtitle: string;
};

export function SectionHeading({ id, title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
      <h2
        id={id}
        className="text-gradient-silver font-display text-4xl leading-[0.95] text-balance uppercase sm:text-5xl"
      >
        {title}
      </h2>
      <p className="text-lg text-pretty text-muted-foreground">{subtitle}</p>
    </div>
  );
}
