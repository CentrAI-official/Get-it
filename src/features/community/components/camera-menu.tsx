"use client";

import { Camera, ImagePlus, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Bouton photo et vidéo : prendre une photo ou filmer sans quitter Get iT (la
 * caméra du téléphone s'ouvre, puis le fichier revient ici), ou choisir dans
 * la galerie. Sur ordinateur, le navigateur propose de choisir un fichier.
 */
export function CameraMenu({
  onFiles,
  disabled,
  className,
  gallery = false,
}: {
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
  className?: string;
  /** Ajoute « Galerie » au menu (plusieurs photos à la fois). */
  gallery?: boolean;
}) {
  const t = useTranslations("Community.camera");
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiles(event.target.files);
    event.target.value = "";
  };

  return (
    <>
      <CameraInputs photoRef={photoRef} videoRef={videoRef} onChange={pick} />
      {gallery ? (
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          onChange={pick}
          className="hidden"
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={gallery ? t("openWithGallery") : t("open")}
            disabled={disabled}
            className={className}
          >
            {gallery ? (
              <ImagePlus aria-hidden="true" />
            ) : (
              <Camera aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="min-w-52">
          <DropdownMenuItem onSelect={() => photoRef.current?.click()}>
            <Camera aria-hidden="true" />
            {t("photo")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => videoRef.current?.click()}>
            <Video aria-hidden="true" />
            {t("video")}
          </DropdownMenuItem>
          {gallery ? (
            <DropdownMenuItem onSelect={() => galleryRef.current?.click()}>
              <ImagePlus aria-hidden="true" />
              {t("gallery")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** Les deux champs cachés de la caméra : photo (caméra directe) et vidéo. */
export function CameraInputs({
  photoRef,
  videoRef,
  onChange,
}: {
  photoRef: React.RefObject<HTMLInputElement | null>;
  videoRef: React.RefObject<HTMLInputElement | null>;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onChange}
        className="hidden"
      />
      <input
        ref={videoRef}
        type="file"
        // Sans « capture » : iPhone et Samsung ouvraient la caméra en mode photo.
        // Le téléphone propose alors « Prendre une vidéo » / « Caméscope ».
        accept="video/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onChange}
        className="hidden"
      />
    </>
  );
}
