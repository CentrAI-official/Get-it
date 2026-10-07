import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const validEnv = {
  DATABASE_URL: "postgresql://user:secret@localhost:6543/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
};

describe("parseServerEnv", () => {
  it("accepte une configuration complète", () => {
    expect(parseServerEnv(validEnv)).toEqual(validEnv);
  });

  it("signale clairement une variable manquante", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it("refuse une URL qui n'est pas PostgreSQL", () => {
    expect(() =>
      parseServerEnv({ ...validEnv, DATABASE_URL: "https://example.com" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("refuse la clé secrète Supabase dans une variable publique", () => {
    expect(() =>
      parseServerEnv({
        ...validEnv,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc123",
      }),
    ).toThrow(/clé publiable/);
  });
});
