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
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contient une clé secrète/);
  });

  it("accepte un code d'invitation facultatif d'au moins 4 caractères", () => {
    expect(parseServerEnv({ ...validEnv, SIGNUP_INVITE_CODE: "" })).toEqual(
      validEnv,
    );
    expect(
      parseServerEnv({ ...validEnv, SIGNUP_INVITE_CODE: " GETIT-2026 " })
        .SIGNUP_INVITE_CODE,
    ).toBe("GETIT-2026");
    expect(() =>
      parseServerEnv({ ...validEnv, SIGNUP_INVITE_CODE: "abc" }),
    ).toThrow(/SIGNUP_INVITE_CODE/);
  });

  it("accepte la clé secrète Supabase côté serveur, facultative", () => {
    expect(parseServerEnv({ ...validEnv, SUPABASE_SECRET_KEY: "" })).toEqual(
      validEnv,
    );
    expect(
      parseServerEnv({ ...validEnv, SUPABASE_SECRET_KEY: "sb_secret_abc123" })
        .SUPABASE_SECRET_KEY,
    ).toBe("sb_secret_abc123");
    expect(() =>
      parseServerEnv({ ...validEnv, SUPABASE_SECRET_KEY: "sb_publishable_x" }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("accepte la clé de l'API Anthropic, facultative", () => {
    expect(parseServerEnv({ ...validEnv, ANTHROPIC_API_KEY: "" })).toEqual(
      validEnv,
    );
    expect(
      parseServerEnv({ ...validEnv, ANTHROPIC_API_KEY: "sk-ant-api03-abc" })
        .ANTHROPIC_API_KEY,
    ).toBe("sk-ant-api03-abc");
    expect(() =>
      parseServerEnv({ ...validEnv, ANTHROPIC_API_KEY: "abc" }),
    ).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("refuse une clé Anthropic dans une variable publique", () => {
    expect(() =>
      parseServerEnv({ ...validEnv, NEXT_PUBLIC_AI_KEY: "sk-ant-api03-abc" }),
    ).toThrow(/NEXT_PUBLIC_AI_KEY/);
  });

  it("réserve le fournisseur factice aux tests", () => {
    expect(
      parseServerEnv({ ...validEnv, AI_PROVIDER: "fake" }).AI_PROVIDER,
    ).toBe("fake");
    expect(() =>
      parseServerEnv({
        ...validEnv,
        AI_PROVIDER: "fake",
        NODE_ENV: "production",
      }),
    ).toThrow(/réservé aux tests/);
  });
});
