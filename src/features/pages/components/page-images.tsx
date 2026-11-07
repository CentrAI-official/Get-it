"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  MediaError,
  prepareAvatar,
  prepareImage,
  uploadFile,
} from "@/features/community/media-client";
import {
  COMMUNITY_ERRORS,
  type CommunityError,
} from "@/features/community/rules";
import {
  removePageImageAction,
  requestPageImageUploadAction,
  setPageImageAction,
} from "../actions";
import { PageLogo } from "./page-logo";

const asError = (code: string): CommunityError =>
  COMMUNITY_ERRORS.find((item) => item === code) ?? "unexpected";

/** Changer une image de la page : le logo (carré) ou la couverture (large). */
function ImagePicker({
  which,
  hasImage,
  label,
  onError,
}: {
  which: "logo" | "cover";
  hasImage: boolean;
  label: string;
  onError: (error: CommunityError | null) => void;
}) {
  const t = useTranslations("Pages.images");
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onError(null);
    setUploading(true);
    try {
      const image =
        which === "logo" ? await prepareAvatar(file) : await prepareImage(file);
      const slots = await requestPageImageUploadAction([
        { mimeType: image.blob.type, size: image.blob.size },
      ]);
      if (!slots.ok) {
        onError(asError(slots.error));
        return;
      }
      const slot = slots.slots[0];
      if (!slot) throw new Error("aucune autorisation");
      await uploadFile(slot.url, image.blob, () => undefined);
      const result = await setPageImageAction(which, {
        uploadId: slot.uploadId,
        width: image.width,
        height: image.height,
      });
      if (!result.ok) onError(asError(result.error));
    } catch (caught) {
      onError(
        caught instanceof MediaError ? asError(caught.code) : "unexpected",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-foreground/12 px-3.5 text-sm font-medium outline-none focus-within:ring-3 focus-within:ring-ring/50 hover:bg-foreground/[0.04]"
      >
        {uploading ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ImagePlus aria-hidden="true" className="size-4" />
        )}
        {label}
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={uploading}
          onChange={choose}
        />
      </label>
      {hasImage ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-muted-foreground"
          disabled={removing}
          onClick={() =>
            startRemove(async () => {
              await removePageImageAction(which);
            })
          }
        >
          <Trash2 aria-hidden="true" />
          {t("remove")}
        </Button>
      ) : null}
    </div>
  );
}

/** Le logo et la couverture de la page, avec leur aperçu. */
export function PageImages({
  name,
  logoUrl,
  coverUrl,
  enabled,
}: {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  /** Sans stockage configuré, les images ne s'envoient pas. */
  enabled: boolean;
}) {
  const t = useTranslations("Pages.images");
  const tErrors = useTranslations("Community.errors");
  const [error, setError] = useState<CommunityError | null>(null);
  if (!enabled) {
    return <p className="text-sm text-muted-foreground">{t("disabled")}</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("cover")}</span>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="aspect-[3/1] w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="aspect-[3/1] w-full rounded-2xl bg-foreground/[0.06]" />
        )}
        <ImagePicker
          which="cover"
          hasImage={coverUrl !== null}
          label={coverUrl ? t("changeCover") : t("addCover")}
          onError={setError}
        />
      </div>
      <div className="flex items-center gap-4">
        <PageLogo name={name} url={logoUrl} className="size-20 text-3xl" />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t("logo")}</span>
          <ImagePicker
            which="logo"
            hasImage={logoUrl !== null}
            label={logoUrl ? t("changeLogo") : t("addLogo")}
            onError={setError}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}
    </div>
  );
}
