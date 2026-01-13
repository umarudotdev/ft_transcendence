// =============================================================================
// Auth Error Types
// =============================================================================

// Using discriminated unions for type-safe error handling
// Each error has a `type` field that TypeScript can narrow on

export type RegisterError =
  | { type: "EMAIL_EXISTS" }
  | { type: "WEAK_PASSWORD"; requirements: string[] };

export type LoginError =
  | { type: "INVALID_CREDENTIALS" } // Generic - prevents email enumeration
  | { type: "EMAIL_NOT_VERIFIED" }
  | { type: "ACCOUNT_LOCKED"; unlockAt: Date }
  | { type: "REQUIRES_2FA"; userId: number }; // User needs to provide 2FA code

export type PasswordError =
  | { type: "INCORRECT_PASSWORD" }
  | { type: "WEAK_PASSWORD"; requirements: string[] }
  | { type: "SAME_AS_CURRENT" };

export type TokenError = { type: "INVALID_TOKEN" } | { type: "EXPIRED_TOKEN" };

export type OAuthError =
  | { type: "INVALID_STATE" }
  | { type: "TOKEN_EXCHANGE_FAILED" }
  | { type: "PROFILE_FETCH_FAILED" }
  | { type: "ACCOUNT_ALREADY_LINKED" };

export type SessionError = { type: "NOT_FOUND" } | { type: "EXPIRED" };

export type TotpError =
  | { type: "INVALID_CODE" }
  | { type: "ALREADY_ENABLED" }
  | { type: "NOT_ENABLED" };
