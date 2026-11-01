"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  adminSignInAction,
  startEnrollmentAction,
  verifyAdminCodeAction,
  type Enrollment,
} from "../actions";
import { initialAdminFormState, type AdminFormError } from "../schemas";

function FormError({ error }: { error: AdminFormError | null }) {
  const t = useTranslations("Admin.access.errors");
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{t(error)}</AlertDescription>
    </Alert>
  );
}

function TextField({
  label,
  ...props
}: Omit<ComponentProps<"input">, "id"> & { label: string }) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} className="h-10" {...props} />
    </Field>
  );
}

function Submit({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

/** Courriel et mot de passe d'un membre de l'équipe. */
export function AdminSignInForm() {
  const t = useTranslations("Admin.access.signIn");
  const locale = useLocale();
  const [state, action, pending] = useActionState(
    adminSignInAction,
    initialAdminFormState,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <FormError error={state.error} />
      <FieldGroup>
        <TextField
          name="email"
          type="email"
          label={t("email")}
          autoComplete="email"
          required
        />
        <TextField
          name="password"
          type="password"
          label={t("password")}
          autoComplete="current-password"
          required
        />
      </FieldGroup>
      <Submit
        pending={pending}
        label={t("submit")}
        pendingLabel={t("pending")}
      />
    </form>
  );
}

/** Code à 6 chiffres de l'application d'authentification. */
export function AdminCodeForm({ factorId }: { factorId?: string }) {
  const t = useTranslations("Admin.access.verify");
  const locale = useLocale();
  const [state, action, pending] = useActionState(
    verifyAdminCodeAction,
    initialAdminFormState,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      {factorId ? (
        <input type="hidden" name="factorId" value={factorId} />
      ) : null}
      <FormError error={state.error} />
      <TextField
        name="code"
        label={t("code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        autoFocus
        className="h-12 text-center font-display text-2xl tracking-[0.3em]"
      />
      <Submit
        pending={pending}
        label={t("submit")}
        pendingLabel={t("pending")}
      />
    </form>
  );
}

/** Première connexion : code QR à scanner, puis le premier code de l'application. */
export function AdminEnrollment() {
  const t = useTranslations("Admin.access.enroll");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  function start() {
    startTransition(async () => {
      setEnrollment(await startEnrollmentAction());
    });
  }

  // Une seule liaison à la fois, commencée à l'ouverture de la page (une
  // nouvelle liaison retire la précédente : jamais deux en mode strict)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, []);

  if (!enrollment || pending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("loading")}
      </p>
    );
  }
  if (!enrollment.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t("failed")}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={start}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const qrSource = enrollment.qrCode.startsWith("data:")
    ? enrollment.qrCode
    : `data:image/svg+xml;utf-8,${encodeURIComponent(enrollment.qrCode)}`;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("scan")}</p>
      {/* Code QR fourni par Supabase (SVG) : rien à optimiser */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrSource}
        alt={t("qrAlt")}
        width={192}
        height={192}
        className="size-48 self-center rounded-xl bg-white p-3"
      />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{t("secret")}</p>
        <code className="text-sm break-all select-all">
          {enrollment.secret}
        </code>
      </div>
      <AdminCodeForm factorId={enrollment.factorId} />
    </div>
  );
}
