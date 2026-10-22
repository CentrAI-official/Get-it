import { describe, expect, it } from "vitest";
import { contactState } from "./rules";

const A = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const B = "0199a1b2-c3d4-7e5f-8a9b-000000000001";

describe("contactState", () => {
  it("aucune relation sans ligne", () => {
    expect(contactState(null, A)).toBe("none");
  });

  it("contacts pour les deux personnes une fois acceptée", () => {
    const row = { status: "accepted" as const, requesterId: A };
    expect(contactState(row, A)).toBe("contact");
    expect(contactState(row, B)).toBe("contact");
  });

  it("demande envoyée pour l’expéditeur, reçue pour l’autre", () => {
    const row = { status: "pending" as const, requesterId: A };
    expect(contactState(row, A)).toBe("sent");
    expect(contactState(row, B)).toBe("received");
  });
});
