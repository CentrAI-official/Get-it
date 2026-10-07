import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("accepte une URL PostgreSQL", () => {
    const url = "postgresql://user:secret@localhost:6543/postgres";
    expect(parseServerEnv({ DATABASE_URL: url })).toEqual({
      DATABASE_URL: url,
    });
  });

  it("signale clairement une variable manquante", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it("refuse une URL qui n'est pas PostgreSQL", () => {
    expect(() =>
      parseServerEnv({ DATABASE_URL: "https://example.com" }),
    ).toThrow(/DATABASE_URL/);
  });
});
