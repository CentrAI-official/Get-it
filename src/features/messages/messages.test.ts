import { describe, expect, it } from "vitest";
import {
  dayOf,
  directKey,
  firstMessageError,
  layoutMessages,
  MESSAGE_MAX_LENGTH,
  messageBodySchema,
  reactionSchema,
  sendPermission,
} from "./rules";

const A = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const B = "0199a1b2-c3d4-7e5f-8a9b-000000000001";

describe("directKey", () => {
  it("donne la même clé quel que soit l'ordre des deux personnes", () => {
    expect(directKey(A, B)).toBe(directKey(B, A));
    expect(directKey(A, B)).toBe(`${B}:${A}`);
  });
});

describe("sendPermission", () => {
  it("laisse écrire dans une conversation acceptée des deux côtés", () => {
    expect(
      sendPermission({
        viewerStatus: "accepted",
        otherStatus: "accepted",
        viewerMessages: 12,
      }),
    ).toBe("ok");
  });

  it("une demande : un seul message tant qu'elle n'est pas acceptée", () => {
    expect(
      sendPermission({
        viewerStatus: "accepted",
        otherStatus: "request",
        viewerMessages: 0,
      }),
    ).toBe("ok");
    expect(
      sendPermission({
        viewerStatus: "accepted",
        otherStatus: "request",
        viewerMessages: 1,
      }),
    ).toBe("requestPending");
  });

  it("la personne qui reçoit une demande l'accepte avant de répondre", () => {
    expect(
      sendPermission({
        viewerStatus: "request",
        otherStatus: "accepted",
        viewerMessages: 0,
      }),
    ).toBe("acceptFirst");
  });
});

describe("messageBodySchema", () => {
  it("retire les espaces et refuse un message vide ou trop long", () => {
    expect(messageBodySchema.parse("  Salut!  ")).toBe("Salut!");
    expect(firstMessageError(messageBodySchema.safeParse("   ").error!)).toBe(
      "bodyRequired",
    );
    expect(
      firstMessageError(
        messageBodySchema.safeParse("a".repeat(MESSAGE_MAX_LENGTH + 1)).error!,
      ),
    ).toBe("bodyTooLong");
  });
});

describe("reactionSchema", () => {
  it("accepte les quatre réactions, ou null pour retirer la sienne", () => {
    for (const kind of ["bravo", "force", "proud", "thanks", null]) {
      expect(reactionSchema.safeParse(kind).success).toBe(true);
    }
    expect(reactionSchema.safeParse("like").success).toBe(false);
  });
});

describe("dayOf", () => {
  it("donne le jour dans le fuseau de l'utilisateur", () => {
    // 2 h UTC le 16 : encore le 15 au Québec
    expect(dayOf("2026-10-16T02:00:00.000Z", "America/Toronto")).toBe(
      "2026-10-15",
    );
    expect(dayOf("2026-10-16T02:00:00.000Z", "UTC")).toBe("2026-10-16");
  });
});

describe("layoutMessages", () => {
  const at = (iso: string, senderId = A) => ({ senderId, createdAt: iso });

  it("sépare les jours et termine un groupe à chaque changement d'auteur", () => {
    const laid = layoutMessages(
      [
        at("2026-10-15T14:00:00.000Z"),
        at("2026-10-15T14:02:00.000Z"),
        at("2026-10-15T14:03:00.000Z", B),
        at("2026-10-16T14:00:00.000Z", B),
      ],
      "America/Toronto",
    );
    expect(laid.map((m) => m.day)).toEqual([
      "2026-10-15",
      null,
      null,
      "2026-10-16",
    ]);
    expect(laid.map((m) => m.groupEnd)).toEqual([false, true, true, true]);
  });

  it("termine un groupe après 10 minutes de silence", () => {
    const laid = layoutMessages(
      [at("2026-10-15T14:00:00.000Z"), at("2026-10-15T14:11:00.000Z")],
      "America/Toronto",
    );
    expect(laid.map((m) => m.groupEnd)).toEqual([true, true]);
  });
});
