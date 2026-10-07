/** Vrai si `value` est un fuseau IANA reconnu (ex. « America/Toronto »). */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "" || value.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
