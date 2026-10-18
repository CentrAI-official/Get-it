import { describe, expect, it } from "vitest";
import {
  fitDimensions,
  kindOf,
  mediaSetError,
  postMediaSchema,
  uploadRequestSchema,
} from "./media";

const id = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("mediaSetError", () => {
  it("accepte jusqu'à 4 photos, ou une seule vidéo", () => {
    expect(mediaSetError(Array(4).fill({ kind: "image" }))).toBeNull();
    expect(mediaSetError([{ kind: "video" }])).toBeNull();
    expect(mediaSetError([])).toBeNull();
  });

  it("refuse 5 photos, deux vidéos, ou une vidéo avec des photos", () => {
    expect(mediaSetError(Array(5).fill({ kind: "image" }))).toBe(
      "mediaTooMany",
    );
    expect(mediaSetError([{ kind: "video" }, { kind: "video" }])).toBe(
      "mediaTooMany",
    );
    expect(mediaSetError([{ kind: "video" }, { kind: "image" }])).toBe(
      "mediaTooMany",
    );
  });
});

describe("fitDimensions", () => {
  it("réduit le plus grand côté sans déformer, n'agrandit jamais", () => {
    expect(fitDimensions(4032, 3024, 2048)).toEqual({
      width: 2048,
      height: 1536,
    });
    expect(fitDimensions(3024, 4032, 2048)).toEqual({
      width: 1536,
      height: 2048,
    });
    expect(fitDimensions(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
});

describe("kindOf", () => {
  it("reconnaît les formats acceptés seulement", () => {
    expect(kindOf("image/webp")).toBe("image");
    expect(kindOf("video/quicktime")).toBe("video");
    expect(kindOf("image/gif")).toBeNull();
    expect(kindOf("text/html")).toBeNull();
  });
});

describe("schémas des médias", () => {
  it("demande d'envoi : formats connus, image d'aperçu facultative", () => {
    expect(
      uploadRequestSchema.parse([{ mimeType: "video/mp4", size: 1000 }]),
    ).toEqual([{ mimeType: "video/mp4", size: 1000, poster: false }]);
    expect(
      uploadRequestSchema.safeParse([{ mimeType: "image/gif", size: 10 }]).error
        ?.issues[0]?.message,
    ).toBe("mediaType");
  });

  it("médias joints : 4 au plus, vidéo de 61 secondes au plus", () => {
    expect(
      postMediaSchema.safeParse([
        { uploadId: id, width: 720, height: 1280, durationMs: 59000 },
      ]).success,
    ).toBe(true);
    expect(
      postMediaSchema.safeParse([
        { uploadId: id, width: 720, height: 1280, durationMs: 90000 },
      ]).error?.issues[0]?.message,
    ).toBe("videoTooLong");
    expect(
      postMediaSchema.safeParse(
        Array(5).fill({ uploadId: id, width: 10, height: 10 }),
      ).error?.issues[0]?.message,
    ).toBe("mediaTooMany");
  });
});
