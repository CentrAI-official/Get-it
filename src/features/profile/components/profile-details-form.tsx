"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { APP_HOME_PATH } from "@/features/auth/access";
import { useRouter } from "@/i18n/navigation";
import { saveProfileDetailsAction } from "../actions";
import type { ProfileDetailError, ProfileDetailsDraft } from "../details";
import { ProfileDetailsFields } from "./profile-details-fields";

type ProfileDetailsFormProps = {
  initial: ProfileDetailsDraft;
  /** Aujourd'hui, dans le fuseau de la personne. */
  today: string;
  /** « complete » : écran unique des comptes existants, puis l'application. */
  mode: "complete" | "settings";
};

/** Renseignements du compte à remplir ou à corriger, enregistrés par le serveur. */
export function ProfileDetailsForm({
  initial,
  today,
  mode,
}: ProfileDetailsFormProps) {
  const t = useTranslations("Details");
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProfileDetailsDraft, ProfileDetailError>>
  >({});
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(false);
    setSaved(false);
    startTransition(async () => {
      const result = await saveProfileDetailsAction(value);
      if (result.ok) {
        setErrors({});
        if (mode === "complete") router.replace(APP_HOME_PATH);
        else setSaved(true);
      } else if ("errors" in result) {
        setErrors(result.errors);
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <ProfileDetailsFields
        value={value}
        onChange={(patch) => {
          setValue((current) => ({ ...current, ...patch }));
          setSaved(false);
        }}
        errors={errors}
        today={today}
      />
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.unexpected")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="h-10">
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {pending
            ? t("saving")
            : mode === "complete"
              ? t("complete.submit")
              : t("save")}
        </Button>
        {saved ? (
          <p role="status" className="text-sm text-primary">
            {t("saved")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
