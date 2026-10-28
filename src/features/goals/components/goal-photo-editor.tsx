"use client";

import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MediaError,
  prepareAvatar,
  uploadFile,
} from "@/features/community/media-client";
import {
  COMMUNITY_ERRORS,
  type CommunityError,
} from "@/features/community/rules";
import {
  removeGoalPhotoAction,
  requestGoalPhotoUploadAction,
  setGoalPhotoAction,
} from "../actions";

type GoalPhotoEditorProps = {
  goalId: string;
  photoUrl: string | null;
  /** Stockage configuré : sinon, pas de photo. */
  photosEnabled: boolean;
};

const asError = (code: string): CommunityError =>
  COMMUNITY_ERRORS.find((item) => item === code) ?? "unexpected";

/**
 * Pastille appareil photo posée sur l'anneau de l'objectif : choisir, changer
 * ou retirer sa photo (recadrée en carré comme la photo de profil).
 */
export function GoalPhotoEditor({
  goalId,
  photoUrl,
  photosEnabled,
}: GoalPhotoEditorProps) {
  const t = useTranslations("Goals.photo");
  const tErrors = useTranslations("Community.errors");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<CommunityError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const image = await prepareAvatar(file);
      const slots = await requestGoalPhotoUploadAction(goalId, [
        { mimeType: image.blob.type, size: image.blob.size },
      ]);
      if (!slots.ok) {
        setError(asError(slots.error));
        return;
      }
      const slot = slots.slots[0];
      if (!slot) throw new Error("aucune autorisation");
      await uploadFile(slot.url, image.blob, () => undefined);
      const result = await setGoalPhotoAction(goalId, {
        uploadId: slot.uploadId,
        width: image.width,
        height: image.height,
      });
      if (result.ok) setOpen(false);
      else setError(asError(result.error));
    } catch (caught) {
      setError(
        caught instanceof MediaError ? asError(caught.code) : "unexpected",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("edit")}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border border-foreground/12 bg-background text-foreground shadow-md transition-colors outline-none hover:bg-foreground/[0.08] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Camera aria-hidden="true" className="size-4 text-primary" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("close")} className="flex flex-col gap-5">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>

          <div className="flex items-center gap-4">
            <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full orb">
              {photoUrl ? (
                // Lien temporaire du stockage privé : pas d'optimisation Next
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="size-full object-cover" />
              ) : (
                <Camera aria-hidden="true" className="size-6 text-silver" />
              )}
              {uploading ? (
                <span className="dark absolute inset-0 flex items-center justify-center bg-black/55">
                  <LoaderCircle
                    aria-label={t("uploading")}
                    className="size-5 animate-spin"
                  />
                </span>
              ) : null}
            </span>
            {photosEnabled ? (
              <div className="flex flex-col gap-2">
                <label className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.03] px-3.5 text-sm font-medium transition-colors hover:bg-foreground/[0.06] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={choose}
                    className="sr-only"
                  />
                  <Camera aria-hidden="true" className="size-4 text-primary" />
                  {photoUrl ? t("change") : t("add")}
                </label>
                {photoUrl ? (
                  <button
                    type="button"
                    disabled={uploading || pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (await removeGoalPhotoAction(goalId)) setOpen(false);
                      })
                    }
                    className="flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {t("remove")}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("unavailable")}
              </p>
            )}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
