"use client";

import { LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { setAiConsentAction } from "../actions";

/**
 * Accord avant le premier usage de Get iT AI (§15, Loi 25) : quelles données
 * sont envoyées, à qui et où, et comment retirer cet accord.
 */
export function AiConsentCard() {
  const t = useTranslations("Coach.consent");
  const [pending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="ai-consent-title"
      className="flex max-w-2xl flex-col gap-5 rounded-3xl glass p-5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 glow-primary">
          <Sparkles aria-hidden="true" className="size-5 text-primary" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id="ai-consent-title" className="font-heading text-xl font-bold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <p>{t("data")}</p>
        <p>{t("processor")}</p>
        <p>{t("control")}</p>
        <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("disclaimer")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={pending}
          onClick={() => startTransition(() => setAiConsentAction(true))}
          className="h-10 px-5"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {t("accept")}
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-10">
          <Link href="/today">{t("later")}</Link>
        </Button>
      </div>
    </section>
  );
}
