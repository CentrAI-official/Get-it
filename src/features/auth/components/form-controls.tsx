"use client";

import { CircleAlert, Eye, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AuthErrorKey } from "../errors";

/** Erreur générale d'un formulaire, annoncée aux lecteurs d'écran. */
export function FormAlert({ error }: { error?: AuthErrorKey }) {
  const t = useTranslations("Auth.errors");
  if (!error) return null;

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{t(error)}</AlertDescription>
    </Alert>
  );
}

type FormFieldProps = Omit<ComponentProps<"input">, "id"> & {
  name: string;
  label: string;
  error?: AuthErrorKey;
  description?: string;
  /** Élément affiché à droite du libellé (ex. « Mot de passe oublié? »). */
  labelAction?: ReactNode;
};

/** Champ de formulaire avec libellé, aide et message d'erreur reliés pour l'accessibilité. */
export function FormField({
  label,
  error,
  description,
  labelAction,
  type,
  className,
  ...inputProps
}: FormFieldProps) {
  const t = useTranslations("Auth.errors");
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const InputComponent = type === "password" ? PasswordInput : Input;

  return (
    <Field data-invalid={error ? true : undefined}>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAction}
      </div>
      <InputComponent
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? errorId : description ? descriptionId : undefined
        }
        className={cn("h-10", className)}
        {...inputProps}
      />
      {error ? (
        <FieldError id={errorId}>{t(error)}</FieldError>
      ) : description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

/** Mot de passe avec un bouton pour l'afficher, utile surtout sur mobile. */
function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  const t = useTranslations("Auth.fields");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("showPassword")}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground aria-pressed:text-foreground"
      >
        <Eye aria-hidden="true" />
      </Button>
    </div>
  );
}

type SubmitButtonProps = {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
};

export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="h-10 w-full text-base"
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
