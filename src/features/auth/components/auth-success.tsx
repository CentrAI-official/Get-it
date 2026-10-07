"use client";

import { MailCheck } from "lucide-react";
import { useEffect, useRef } from "react";

type AuthSuccessProps = {
  title: string;
  description: string;
  hint?: string;
};

/** Confirmation qui remplace un formulaire envoyé (ex. « Vérifie ta boîte de réception »). */
export function AuthSuccess({ title, description, hint }: AuthSuccessProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Le formulaire disparaît : on déplace le focus pour que le message soit lu
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      className="flex flex-col items-start gap-4 rounded-xl border bg-card/60 p-6"
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MailCheck aria-hidden="true" className="size-5" />
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-lg font-semibold outline-none"
      >
        {title}
      </h2>
      <p className="text-muted-foreground">{description}</p>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
