"use client";

import {
  ImagePlus,
  LoaderCircle,
  MapPin,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { TimeWheel } from "@/components/time-wheel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PILLARS, type Pillar } from "@/config/pillars";
import { useMediaUploads } from "@/features/community/use-media-uploads";
import { currentIdentity } from "@/features/identity/client";
import { IN_PERSON_REGIONS } from "@/features/marketplace/rules";
import { PlaceField } from "@/features/places/components/place-field";
import { clockDate, formatClock, parseClock } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { EditableEvent } from "@/server/community-events/service";
import {
  saveCommunityEventAction,
  type CommunityEventFormState,
} from "../actions";
import {
  COMMUNITY_EVENT_LIMITS,
  EVENT_FORMATS,
  type CommunityEventField,
  type EventFormat,
} from "../rules";

const FIELD =
  "h-11 min-w-0 rounded-xl bg-foreground/6 px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-2 aria-invalid:ring-destructive/60";
const chip =
  "flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/14 text-primary";
const chipOff = "border-border bg-card text-foreground hover:bg-foreground/5";

/**
 * Créer ou modifier un événement de la Communauté : la photo de couverture, le
 * titre, en personne (adresse proposée, région) ou en ligne (lien), le début
 * et une fin facultative (dans mon fuseau), le sujet, la description et un
 * nombre de places facultatif.
 */
export function CommunityEventForm({
  event,
  defaults,
  owner = null,
}: {
  /** L'événement à modifier, ou null pour en créer un. */
  event: EditableEvent | null;
  /** Pour un nouvel événement : demain à 18 h, et ma région. */
  defaults: { day: string; minute: number; region: string | null };
  /** Au nom de ma page pro, ou dans un groupe (création seulement). */
  owner?: { page: string } | { group: { id: string; name: string } } | null;
}) {
  const t = useTranslations("CommunityEvents.form");
  const tErrors = useTranslations("CommunityEvents.errors");
  const tTopics = useTranslations("CommunityEvents.topics");
  const tRegions = useTranslations("Marketplace.regions");
  const tMedia = useTranslations("Community.media");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const [state, formAction, pending] = useActionState<
    CommunityEventFormState,
    FormData
  >(saveCommunityEventAction.bind(null, event?.id ?? null), {
    status: "idle",
  });
  const uploads = useMediaUploads({ photosOnly: true });
  const upload = uploads.items[0];

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventFormat, setEventFormat] = useState<EventFormat>(
    event?.format ?? "in_person",
  );
  const [location, setLocation] = useState(event?.location ?? "");
  const [region, setRegion] = useState(event?.region ?? defaults.region ?? "");
  const [onlineUrl, setOnlineUrl] = useState(event?.onlineUrl ?? "");
  const [topic, setTopic] = useState<Pillar | null>(event?.topic ?? null);
  const [startDate, setStartDate] = useState(event?.startDay ?? defaults.day);
  const [startTime, setStartTime] = useState(
    formatClock(event?.startMinute ?? defaults.minute),
  );
  const [hasEnd, setHasEnd] = useState(
    event?.endDay !== null && event !== null,
  );
  const [endDate, setEndDate] = useState(event?.endDay ?? startDate);
  const [endTime, setEndTime] = useState(
    formatClock(
      event?.endMinute ??
        Math.min(23 * 60 + 59, (event?.startMinute ?? defaults.minute) + 120),
    ),
  );
  const [capacity, setCapacity] = useState(
    event?.capacity ? String(event.capacity) : "",
  );
  // Photo actuelle (modification) : gardée tant qu'on ne la retire pas
  const [keptCover, setKeptCover] = useState(event?.coverUrl ?? null);
  const [wheel, setWheel] = useState<"start" | "end" | null>(null);

  const clock = (value: string) => {
    const minute = parseClock(value);
    return minute === null
      ? value
      : format.dateTime(clockDate(minute), {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        });
  };
  const fieldError = (field: CommunityEventField) => state.fieldErrors?.[field];
  const message = (field: CommunityEventField) => {
    const key = fieldError(field);
    return key ? tErrors(key) : null;
  };
  const cover = upload
    ? uploads.payload
    : keptCover
      ? "keep"
      : event?.coverUrl
        ? "remove"
        : "[]";
  const preview = upload?.previewUrl ?? keptCover;
  const ownerLabel =
    owner && "page" in owner
      ? t("asPage", { page: owner.page })
      : owner && "group" in owner
        ? t("inGroup", { group: owner.group.name })
        : event?.pageName
          ? t("asPage", { page: event.pageName })
          : event?.group
            ? t("inGroup", { group: event.group.name })
            : null;

  return (
    <form
      action={(formData) => {
        // Au nom du compte sous lequel l'écran a été chargé (revérifié par le serveur)
        formData.set("identity", currentIdentity());
        formAction(formData);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="cover" value={cover} />
      <input type="hidden" name="format" value={eventFormat} />
      <input type="hidden" name="topic" value={topic ?? ""} />
      {owner && "group" in owner ? (
        <input type="hidden" name="groupId" value={owner.group.id} />
      ) : null}
      {ownerLabel ? (
        <p className="flex items-center gap-2 rounded-2xl bg-primary/[0.07] px-4 py-3 text-sm font-medium">
          <UsersRound
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          {ownerLabel}
        </p>
      ) : null}

      {/* Photo de couverture, au format 16:9 */}
      <div className="flex flex-col gap-2">
        {preview ? (
          <div className="relative overflow-hidden rounded-3xl bg-foreground/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              className="aspect-[16/9] w-full object-cover"
            />
            {upload && upload.status !== "done" ? (
              <span className="dark absolute inset-0 flex items-center justify-center gap-2 bg-black/55 text-sm font-medium">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-5 animate-spin"
                />
                {upload.status === "uploading"
                  ? tMedia("uploading", {
                      percent: Math.round(upload.progress * 100),
                    })
                  : tMedia("preparing")}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={t("removeCover")}
              onClick={() => {
                if (upload) uploads.remove(upload.id);
                else setKeptCover(null);
              }}
              className="dark absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-black/60 text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        ) : (
          <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-foreground/15 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(change) => {
                uploads.reset();
                uploads.add(change.target.files);
                change.target.value = "";
              }}
            />
            <ImagePlus aria-hidden="true" className="size-7 text-primary" />
            {t("addCover")}
            <span className="text-xs font-normal">{t("coverHint")}</span>
          </label>
        )}
        {upload?.error || uploads.error ? (
          <p role="alert" className="text-sm text-destructive">
            {tErrors("coverInvalid")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-title`} className="text-sm font-medium">
          {t("title")}
        </label>
        <input
          id={`${id}-title`}
          name="title"
          value={title}
          onChange={(change) => setTitle(change.target.value)}
          maxLength={COMMUNITY_EVENT_LIMITS.titleMax}
          placeholder={t("titlePlaceholder")}
          autoComplete="off"
          aria-invalid={fieldError("title") ? true : undefined}
          className={cn(FIELD, "h-12 font-medium")}
        />
        {message("title") ? (
          <p className="text-sm text-destructive">{message("title")}</p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">{t("format")}</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_FORMATS.map((value) => (
            <label
              key={value}
              className={cn(chip, eventFormat === value ? chipOn : chipOff)}
            >
              <input
                type="radio"
                name="formatChoice"
                value={value}
                checked={eventFormat === value}
                onChange={() => setEventFormat(value)}
                className="sr-only"
              />
              {value === "online" ? (
                <Video aria-hidden="true" className="size-4" />
              ) : (
                <MapPin aria-hidden="true" className="size-4" />
              )}
              {t(`formats.${value}`)}
            </label>
          ))}
        </div>
        {eventFormat === "in_person" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-location`} className="sr-only">
                {t("location")}
              </label>
              <PlaceField
                id={`${id}-location`}
                name="location"
                value={location}
                onChange={setLocation}
                maxLength={COMMUNITY_EVENT_LIMITS.location}
                placeholder={t("locationPlaceholder")}
                invalid={Boolean(fieldError("location"))}
                inputClassName={cn(FIELD, "w-full")}
              />
              {message("location") ? (
                <p className="text-sm text-destructive">
                  {message("location")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-region`} className="text-sm font-medium">
                {t("region")}
              </label>
              <select
                id={`${id}-region`}
                name="region"
                value={region}
                onChange={(change) => setRegion(change.target.value)}
                className={cn(FIELD, "w-full sm:w-80")}
              >
                <option value="">{t("noRegion")}</option>
                {IN_PERSON_REGIONS.map((value) => (
                  <option key={value} value={value}>
                    {tRegions(value)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("regionHint")}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-url`} className="sr-only">
              {t("onlineUrl")}
            </label>
            <input
              id={`${id}-url`}
              name="onlineUrl"
              type="url"
              inputMode="url"
              value={onlineUrl}
              onChange={(change) => setOnlineUrl(change.target.value)}
              maxLength={COMMUNITY_EVENT_LIMITS.url}
              placeholder="https://"
              autoComplete="off"
              aria-invalid={fieldError("onlineUrl") ? true : undefined}
              className={cn(FIELD, "w-full")}
            />
            <p className="text-xs text-muted-foreground">{t("onlineHint")}</p>
            {message("onlineUrl") ? (
              <p className="text-sm text-destructive">{message("onlineUrl")}</p>
            ) : null}
          </div>
        )}
      </fieldset>

      {/* Début et fin, dans mon fuseau */}
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div
            role="group"
            aria-labelledby={`${id}-start`}
            className="flex flex-col gap-2 border-b border-border px-4 py-3"
          >
            <span
              id={`${id}-start`}
              className="text-sm font-medium text-muted-foreground"
            >
              {t("start")}
            </span>
            <span className="flex gap-2">
              <input
                type="date"
                name="startDate"
                aria-label={t("startDate")}
                value={startDate}
                onChange={(change) => {
                  setStartDate(change.target.value);
                  if (endDate < change.target.value)
                    setEndDate(change.target.value);
                }}
                aria-invalid={fieldError("startDate") ? true : undefined}
                className={cn(FIELD, "flex-1 text-sm")}
              />
              <input type="hidden" name="startTime" value={startTime} />
              <button
                type="button"
                aria-label={t("startTimeAt", { time: clock(startTime) })}
                aria-expanded={wheel === "start"}
                onClick={() => setWheel(wheel === "start" ? null : "start")}
                className={cn(
                  FIELD,
                  "w-28 shrink-0 text-left text-sm tabular-nums",
                  wheel === "start" && "text-primary",
                )}
              >
                {clock(startTime)}
              </button>
            </span>
            {wheel === "start" ? (
              <TimeWheel
                value={startTime}
                onChange={setStartTime}
                labelledBy={`${id}-start`}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-2 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={hasEnd}
                onCheckedChange={(value) => {
                  setHasEnd(value === true);
                  if (value !== true && wheel === "end") setWheel(null);
                }}
              />
              {t("addEnd")}
            </label>
            {hasEnd ? (
              <div
                role="group"
                aria-labelledby={`${id}-end`}
                className="flex flex-col gap-2"
              >
                <span id={`${id}-end`} className="sr-only">
                  {t("end")}
                </span>
                <span className="flex gap-2">
                  <input
                    type="date"
                    name="endDate"
                    aria-label={t("endDate")}
                    value={endDate}
                    min={startDate}
                    onChange={(change) => setEndDate(change.target.value)}
                    aria-invalid={fieldError("endDate") ? true : undefined}
                    className={cn(FIELD, "flex-1 text-sm")}
                  />
                  <input type="hidden" name="endTime" value={endTime} />
                  <button
                    type="button"
                    aria-label={t("endTimeAt", { time: clock(endTime) })}
                    aria-expanded={wheel === "end"}
                    onClick={() => setWheel(wheel === "end" ? null : "end")}
                    className={cn(
                      FIELD,
                      "w-28 shrink-0 text-left text-sm tabular-nums",
                      wheel === "end" && "text-primary",
                    )}
                  >
                    {clock(endTime)}
                  </button>
                </span>
                {wheel === "end" ? (
                  <TimeWheel
                    value={endTime}
                    onChange={setEndTime}
                    labelledBy={`${id}-end`}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {(["startDate", "startTime", "endDate", "endTime"] as const).map(
          (field) =>
            message(field) ? (
              <p key={field} className="text-sm text-destructive">
                {message(field)}
              </p>
            ) : null,
        )}
        <p className="text-xs text-muted-foreground">{t("timeZoneHint")}</p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">{t("topic")}</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={topic === null}
            onClick={() => setTopic(null)}
            className={cn(chip, topic === null ? chipOn : chipOff)}
          >
            {tTopics("general")}
          </button>
          {PILLARS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={topic === value}
              onClick={() => setTopic(topic === value ? null : value)}
              className={cn(chip, topic === value ? chipOn : chipOff)}
            >
              {tTopics(value)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-description`} className="text-sm font-medium">
          {t("description")}
        </label>
        <textarea
          id={`${id}-description`}
          name="description"
          value={description}
          onChange={(change) => setDescription(change.target.value)}
          maxLength={COMMUNITY_EVENT_LIMITS.description}
          rows={5}
          placeholder={t("descriptionPlaceholder")}
          className="min-h-32 rounded-2xl bg-foreground/6 p-3 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span className="self-end text-xs text-muted-foreground tabular-nums">
          {t("length", {
            count: description.length,
            max: COMMUNITY_EVENT_LIMITS.description,
          })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-capacity`} className="text-sm font-medium">
          {t("capacity")}
        </label>
        <input
          id={`${id}-capacity`}
          name="capacity"
          type="number"
          inputMode="numeric"
          min={COMMUNITY_EVENT_LIMITS.capacityMin}
          max={COMMUNITY_EVENT_LIMITS.capacityMax}
          value={capacity}
          onChange={(change) => setCapacity(change.target.value)}
          placeholder={t("capacityPlaceholder")}
          aria-invalid={fieldError("capacity") ? true : undefined}
          className={cn(FIELD, "w-40")}
        />
        {message("capacity") ? (
          <p className="text-sm text-destructive">{message("capacity")}</p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(state.error)}
        </p>
      ) : state.fieldErrors ? (
        <p role="alert" className="text-sm text-destructive">
          {t("checkFields")}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || !uploads.ready}
        className="h-12 w-full rounded-full text-base sm:w-fit sm:px-8"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {event ? t("save") : t("publish")}
      </Button>
    </form>
  );
}
