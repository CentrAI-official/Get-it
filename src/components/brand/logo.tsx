import { cn } from "@/lib/utils";

/** Logo texte « Get iT », avec « iT » en orange. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading text-xl font-bold tracking-tight text-foreground",
        className,
      )}
    >
      Get <span className="text-primary">iT</span>
    </span>
  );
}
