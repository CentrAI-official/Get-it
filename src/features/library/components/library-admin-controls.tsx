"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { importLibrarySeedAction } from "../actions";

/** Importe le contenu de départ en brouillons (les fiches déjà importées sont ignorées). */
export function ImportSeedButton() {
  const t = useTranslations("LibraryAdmin.import");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await importLibrarySeedAction());
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {t("button")}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {result === null
          ? t("hint")
          : result > 0
            ? t("done", { count: result })
            : t("none")}
      </p>
    </div>
  );
}
