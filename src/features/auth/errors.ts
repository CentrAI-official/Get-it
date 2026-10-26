/** Erreurs affichables par les formulaires d'authentification (clés de `Auth.errors`). */
export const AUTH_ERROR_KEYS = [
  "emailInvalid",
  "passwordRequired",
  "passwordTooShort",
  "passwordTooLong",
  "passwordMismatch",
  "invalidCredentials",
  "emailNotConfirmed",
  "emailTaken",
  "weakPassword",
  "samePassword",
  "rateLimited",
  "emailNotAuthorized",
  "sessionExpired",
  "linkInvalid",
  "inviteInvalid",
  "inviteRequired",
  "unexpected",
] as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

export function isAuthErrorKey(value: unknown): value is AuthErrorKey {
  return AUTH_ERROR_KEYS.includes(value as AuthErrorKey);
}

/** Codes d'erreur de Supabase Auth traduits en messages compréhensibles. */
const SUPABASE_ERROR_KEYS: Record<string, AuthErrorKey> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  user_already_exists: "emailTaken",
  email_exists: "emailTaken",
  weak_password: "weakPassword",
  same_password: "samePassword",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "rateLimited",
  email_address_invalid: "emailInvalid",
  email_address_not_authorized: "emailNotAuthorized",
  session_not_found: "sessionExpired",
  session_expired: "sessionExpired",
  otp_expired: "linkInvalid",
  flow_state_not_found: "linkInvalid",
  flow_state_expired: "linkInvalid",
  bad_code_verifier: "linkInvalid",
};

/** Traduit un code d'erreur Supabase ; tout code inconnu devient une erreur générique. */
export function toAuthErrorKey(code: string | undefined): AuthErrorKey {
  return (code && SUPABASE_ERROR_KEYS[code]) || "unexpected";
}
