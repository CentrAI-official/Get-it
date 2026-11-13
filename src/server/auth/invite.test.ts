import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceKey, inviteFailed, inviteLocked } from "./invite";

afterEach(() => {
  vi.useRealTimers();
});

/** Un essai raté, sans attendre la vraie pause. */
async function fail(device: string, now: number) {
  vi.useFakeTimers();
  const done = inviteFailed(device, now);
  await vi.runAllTimersAsync();
  await done;
  vi.useRealTimers();
}

describe("essais du code d'invitation", () => {
  it("bloque un appareil après 10 essais ratés, pendant 15 minutes", async () => {
    const device = deviceKey("203.0.113.7, 10.0.0.1", null);
    const start = 1_000_000;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      await fail(device, start + attempt);
    }
    expect(inviteLocked(device, start + 10)).toBe(false);
    await fail(device, start + 11);
    expect(inviteLocked(device, start + 12)).toBe(true);
    // Un autre appareil n'est pas touché
    expect(inviteLocked(deviceKey("198.51.100.4", null), start + 12)).toBe(
      false,
    );
    // 15 minutes plus tard, on peut réessayer
    expect(inviteLocked(device, start + 15 * 60_000 + 1)).toBe(false);
  });

  it("l'appareil est la première adresse, jamais gardée telle quelle", () => {
    const key = deviceKey("203.0.113.7, 10.0.0.1", null);
    expect(key).toBe(deviceKey("203.0.113.7", null));
    expect(key).not.toContain("203");
    expect(deviceKey(null, "198.51.100.4")).toBe(
      deviceKey("198.51.100.4", null),
    );
  });
});
