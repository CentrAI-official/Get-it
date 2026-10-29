import { cn } from "@/lib/utils";

/** Logo texte « GET IT. » : Anton en majuscules, le point en orange. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-2xl leading-none tracking-tight text-foreground uppercase",
        className,
      )}
    >
      Get iT
      <span aria-hidden="true" className="text-primary">
        .
      </span>
    </span>
  );
}
