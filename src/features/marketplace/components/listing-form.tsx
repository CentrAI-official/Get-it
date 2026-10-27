"use client";

import { CircleAlert, LoaderCircle, Package, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PILLARS, type Pillar } from "@/config/pillars";
import { MediaPicker } from "@/features/community/components/media-picker";
import { COMMUNITY_ERRORS } from "@/features/community/rules";
import { useMediaUploads } from "@/features/community/use-media-uploads";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createListingAction, requestListingUploadsAction } from "../actions";
import {
  CONTACT_NAME_MAX,
  GEAR_CATEGORIES,
  LICENSE_MAX,
  LISTING_DESCRIPTION_MAX,
  LISTING_SUMMARY_MAX,
  LISTING_TITLE_MAX,
  REGIONS,
  REGULATED_CATEGORIES,
  SERVICE_CATEGORIES,
  SERVICE_PRICE_UNITS,
  URL_MAX,
  type ListingCategory,
  type ListingKind,
  type MarketplaceError,
  type Region,
  type ServicePriceUnit,
  GEAR_SALES_OPEN,
} from "../rules";

/** Autorisation d'envoi des photos, avec les erreurs connues des publications. */
async function requestPhotoUploads(
  files: Parameters<typeof requestListingUploadsAction>[0],
) {
  const result = await requestListingUploadsAction(files);
  if (result.ok) return result;
  return {
    ok: false as const,
    error:
      COMMUNITY_ERRORS.find((code) => code === result.error) ?? "unexpected",
  };
}

const choice =
  "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const choiceOn = "border-primary bg-primary/15 text-foreground";
const choiceOff =
  "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground";

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
  multiple = false,
  error,
}: {
  label: string;
  options: readonly T[];
  value: T | T[] | null;
  onChange: (value: T) => void;
  render: (option: T) => string;
  multiple?: boolean;
  error?: string;
}) {
  const selected = (option: T) =>
    Array.isArray(value) ? value.includes(option) : value === option;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div
        role={multiple ? "group" : "radiogroup"}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected(option)}
            onClick={() => onChange(option)}
            className={cn(choice, selected(option) ? choiceOn : choiceOff)}
          >
            {render(option)}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function TextField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      data-invalid={error ? true : undefined}
    >
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type ListingFormProps = {
  defaultEmail: string;
  defaultName: string;
  /** Stockage configuré : sinon, pas de photos. */
  photosEnabled: boolean;
};

/**
 * « Vendre » : un service ou du gear. L'annonce part en approbation chez
 * l'équipe Get iT ; le nom, le courriel et le permis ne sont jamais publiés.
 */
export function ListingForm({
  defaultEmail,
  defaultName,
  photosEnabled,
}: ListingFormProps) {
  const t = useTranslations("Marketplace");
  const tPillars = useTranslations("Pillars");
  const tMedia = useTranslations("Community.errors");
  const router = useRouter();
  const id = useId();
  const media = useMediaUploads({
    photosOnly: true,
    request: requestPhotoUploads,
  });
  const [kind, setKind] = useState<ListingKind>("service");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [unit, setUnit] = useState<ServicePriceUnit>("session");
  const [regions, setRegions] = useState<Region[]>([]);
  const [values, setValues] = useState({
    title: "",
    summary: "",
    description: "",
    priceMin: "",
    priceMax: "",
    licenseNumber: "",
    contactName: defaultName,
    contactEmail: defaultEmail,
    website: "",
    socialUrl: "",
  });
  const [error, setError] = useState<MarketplaceError | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const service = kind === "service";
  const regulated =
    service &&
    category !== null &&
    REGULATED_CATEGORIES.some((item) => item === category);

  /** Une erreur disparaît dès que le champ concerné change. */
  function clear(...names: string[]) {
    setFields((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([name]) => !names.includes(name)),
      ),
    );
  }

  const set = (key: keyof typeof values) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    clear(key);
  };

  /** Message d'un champ : précis pour l'ordre des prix et le permis, sinon par champ. */
  function fieldError(name: string) {
    const code = fields[name];
    if (!code) return undefined;
    if (code === "priceOrder" || code === "licenseRequired") {
      return t(`form.errors.${code}`);
    }
    return t(`form.fieldErrors.${name as "title"}`);
  }

  function switchKind(next: ListingKind) {
    setKind(next);
    setCategory(null);
    setFields({});
  }

  function toggleRegion(region: Region) {
    clear("regions");
    setRegions((current) =>
      current.includes(region)
        ? current.filter((item) => item !== region)
        : [...current, region],
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !media.ready) return;
    setError(null);
    startTransition(async () => {
      const result = await createListingAction({
        kind,
        category,
        pillar,
        title: values.title,
        summary: values.summary,
        description: values.description,
        priceMin: values.priceMin,
        contactName: values.contactName,
        contactEmail: values.contactEmail,
        website: values.website,
        socialUrl: values.socialUrl,
        media: JSON.parse(media.payload) as unknown,
        ...(service
          ? {
              priceMax: values.priceMax,
              priceUnit: unit,
              regions,
              licenseNumber: values.licenseNumber,
            }
          : {}),
      });
      if (result.ok) {
        router.push(`/marketplace/${result.id}`);
        return;
      }
      setError(result.error);
      setFields(result.fields ?? {});
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const input = (name: keyof typeof values, max: number, extra = {}) => ({
    id: `${id}-${name}`,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      set(name)(event.target.value),
    maxLength: max,
    "aria-invalid": fields[name] ? true : undefined,
    "aria-describedby": fields[name] ? `${id}-${name}-error` : undefined,
    className: "h-11",
    ...extra,
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-2xl flex-col gap-8"
    >
      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t(`form.errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}

      {/* Service ou gear (gear : bientôt) */}
      {GEAR_SALES_OPEN ? (
        <div
          role="radiogroup"
          aria-label={t("form.kind")}
          className="grid grid-cols-2 gap-2"
        >
          {(
            [
              ["service", UserRound],
              ["gear", Package],
            ] as const
          ).map(([value, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => switchKind(value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                kind === value ? choiceOn : choiceOff,
              )}
            >
              <Icon aria-hidden="true" className="size-5 text-primary" />
              <span className="font-semibold text-foreground">
                {t(`form.kinds.${value}`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`form.kindHints.${value}`)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <section className="flex flex-col gap-5">
        <Choices
          label={t("form.category")}
          options={service ? SERVICE_CATEGORIES : GEAR_CATEGORIES}
          value={category}
          onChange={(value) => {
            setCategory(value);
            clear("category", "licenseNumber");
          }}
          render={(value) => t(`categories.${value}`)}
          error={fieldError("category")}
        />
        <Choices
          label={t("form.pillar")}
          options={PILLARS}
          value={pillar}
          onChange={(value) => {
            setPillar(value);
            clear("pillar");
          }}
          render={(value) => tPillars(`${value}.name`)}
          error={fieldError("pillar")}
        />
        <TextField
          id={`${id}-title`}
          label={t("form.title")}
          error={fieldError("title")}
        >
          <Input
            {...input("title", LISTING_TITLE_MAX)}
            placeholder={t(`form.titlePlaceholder.${kind}`)}
          />
        </TextField>
        <TextField
          id={`${id}-summary`}
          label={t("form.summary")}
          hint={t("form.summaryHint")}
          error={fieldError("summary")}
        >
          <Input {...input("summary", LISTING_SUMMARY_MAX)} />
        </TextField>
        <TextField
          id={`${id}-description`}
          label={t("form.description")}
          error={fieldError("description")}
        >
          <Textarea
            id={`${id}-description`}
            value={values.description}
            onChange={(event) => set("description")(event.target.value)}
            maxLength={LISTING_DESCRIPTION_MAX}
            rows={6}
            aria-invalid={fields.description ? true : undefined}
            placeholder={t(`form.descriptionPlaceholder.${kind}`)}
          />
        </TextField>
      </section>

      {/* Prix */}
      <section className="flex flex-col gap-5 border-t border-white/8 pt-6">
        <h2 className="font-heading text-lg font-bold">
          {t("form.priceTitle")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id={`${id}-priceMin`}
            label={service ? t("form.priceFrom") : t("form.price")}
            error={fieldError("priceMin")}
          >
            <Input
              {...input("priceMin", 12, {
                inputMode: "decimal",
                placeholder: "80",
              })}
            />
          </TextField>
          {service ? (
            <TextField
              id={`${id}-priceMax`}
              label={t("form.priceTo")}
              hint={t("form.optional")}
              error={fieldError("priceMax")}
            >
              <Input
                {...input("priceMax", 12, {
                  inputMode: "decimal",
                  placeholder: "120",
                })}
              />
            </TextField>
          ) : null}
        </div>
        {service ? (
          <Choices
            label={t("form.unit")}
            options={SERVICE_PRICE_UNITS}
            value={unit}
            onChange={(value) => setUnit(value)}
            render={(value) => t(`form.units.${value}`)}
          />
        ) : null}
        <p className="text-xs text-muted-foreground">{t("form.priceHint")}</p>
      </section>

      {service ? (
        <section className="flex flex-col gap-5 border-t border-white/8 pt-6">
          <Choices
            label={t("form.regions")}
            options={REGIONS}
            value={regions}
            multiple
            onChange={toggleRegion}
            render={(value) => t(`regions.${value}`)}
            error={fieldError("regions")}
          />
          <TextField
            id={`${id}-licenseNumber`}
            label={
              regulated
                ? t("form.license")
                : `${t("form.license")} (${t("form.optional")})`
            }
            hint={t("form.licenseHint")}
            error={fieldError("licenseNumber")}
          >
            <Input {...input("licenseNumber", LICENSE_MAX)} />
          </TextField>
        </section>
      ) : null}

      {photosEnabled ? (
        <section className="flex flex-col gap-3 border-t border-white/8 pt-6">
          <h2 className="font-heading text-lg font-bold">{t("form.photos")}</h2>
          <MediaPicker
            items={media.items}
            onAdd={media.add}
            onRemove={media.remove}
            disabled={pending || media.items.length >= 4}
            photosOnly
          />
          {media.error ? (
            <p role="alert" className="text-sm text-destructive">
              {tMedia(media.error)}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Liens publics */}
      <section className="flex flex-col gap-5 border-t border-white/8 pt-6">
        <h2 className="font-heading text-lg font-bold">
          {t("form.linksTitle")}
        </h2>
        <TextField
          id={`${id}-website`}
          label={t("form.website")}
          hint={t("form.optional")}
          error={fieldError("website")}
        >
          <Input
            {...input("website", URL_MAX, {
              inputMode: "url",
              placeholder: "monsite.ca",
            })}
          />
        </TextField>
        <TextField
          id={`${id}-socialUrl`}
          label={t("form.social")}
          hint={t("form.optional")}
          error={fieldError("socialUrl")}
        >
          <Input
            {...input("socialUrl", URL_MAX, {
              inputMode: "url",
              placeholder: "instagram.com/…",
            })}
          />
        </TextField>
      </section>

      {/* Réservé à l'équipe Get iT */}
      <section className="flex flex-col gap-5 border-t border-white/8 pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-bold">
            {t("form.privateTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("form.privateDescription")}
          </p>
        </div>
        <TextField
          id={`${id}-contactName`}
          label={t("form.contactName")}
          error={fieldError("contactName")}
        >
          <Input
            {...input("contactName", CONTACT_NAME_MAX, {
              autoComplete: "name",
            })}
          />
        </TextField>
        <TextField
          id={`${id}-contactEmail`}
          label={t("form.contactEmail")}
          error={fieldError("contactEmail")}
        >
          <Input
            {...input("contactEmail", 254, {
              type: "email",
              autoComplete: "email",
            })}
          />
        </TextField>
      </section>

      <div className="flex flex-col gap-3 border-t border-white/8 pt-6">
        <p className="text-sm text-muted-foreground">
          {t("form.reviewNotice")}
        </p>
        <Button
          type="submit"
          size="lg"
          className="w-fit"
          disabled={pending || !media.ready}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
