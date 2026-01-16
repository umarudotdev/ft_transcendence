import { t } from "elysia";

import {
  badRequest,
  conflict,
  forbidden,
  locked,
  serviceUnavailable,
  unauthorized,
  validationError,
} from "../../common/errors";

export const AuthModel = {
  register: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 8 }),
    displayName: t.String({ minLength: 3, maxLength: 30 }),
  }),

  login: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 1 }),
  }),

  totpCode: t.Object({
    code: t.String({ pattern: "^[0-9]{6}$" }),
  }),

  verifyEmail: t.Object({
    token: t.String(),
  }),

  forgotPassword: t.Object({
    email: t.String({ format: "email" }),
  }),

  resetPassword: t.Object({
    token: t.String(),
    password: t.String({ minLength: 8 }),
  }),

  changePassword: t.Object({
    currentPassword: t.String(),
    newPassword: t.String({ minLength: 8 }),
  }),

  oauthCallback: t.Object({
    code: t.Optional(t.String()),
    state: t.Optional(t.String()),
    error: t.Optional(t.String()),
  }),

  safeUser: t.Object({
    id: t.Number(),
    email: t.String(),
    displayName: t.String(),
    avatarUrl: t.Nullable(t.String()),
    emailVerified: t.Boolean(),
    twoFactorEnabled: t.Boolean(),
    intraId: t.Nullable(t.Number()),
    role: t.Union([
      t.Literal("user"),
      t.Literal("moderator"),
      t.Literal("admin"),
    ]),
    createdAt: t.Date(),
  }),

  registerError: t.Union([
    t.Object({ type: t.Literal("EMAIL_EXISTS") }),
    t.Object({
      type: t.Literal("WEAK_PASSWORD"),
      requirements: t.Array(t.String()),
    }),
  ]),

  loginError: t.Union([
    t.Object({ type: t.Literal("INVALID_CREDENTIALS") }),
    t.Object({ type: t.Literal("EMAIL_NOT_VERIFIED") }),
    t.Object({ type: t.Literal("ACCOUNT_LOCKED"), unlockAt: t.Date() }),
    t.Object({ type: t.Literal("REQUIRES_2FA"), userId: t.Number() }),
  ]),

  passwordError: t.Union([
    t.Object({ type: t.Literal("INCORRECT_PASSWORD") }),
    t.Object({
      type: t.Literal("WEAK_PASSWORD"),
      requirements: t.Array(t.String()),
    }),
    t.Object({ type: t.Literal("SAME_AS_CURRENT") }),
  ]),

  tokenError: t.Union([
    t.Object({ type: t.Literal("INVALID_TOKEN") }),
    t.Object({ type: t.Literal("EXPIRED_TOKEN") }),
  ]),

  oauthError: t.Union([
    t.Object({ type: t.Literal("INVALID_STATE") }),
    t.Object({ type: t.Literal("TOKEN_EXCHANGE_FAILED") }),
    t.Object({ type: t.Literal("PROFILE_FETCH_FAILED") }),
    t.Object({ type: t.Literal("ACCOUNT_ALREADY_LINKED") }),
  ]),

  unlinkOAuth: t.Object({
    password: t.String({ minLength: 1 }),
  }),

  deleteAccount: t.Object({
    password: t.String({ minLength: 1 }),
  }),

  deleteAccountError: t.Union([
    t.Object({ type: t.Literal("INVALID_PASSWORD") }),
    t.Object({ type: t.Literal("OAUTH_ONLY_ACCOUNT") }),
  ]),

  oauthUnlinkError: t.Union([
    t.Object({ type: t.Literal("NOT_LINKED") }),
    t.Object({ type: t.Literal("PASSWORD_REQUIRED") }),
    t.Object({ type: t.Literal("INVALID_PASSWORD") }),
  ]),

  sessionError: t.Union([
    t.Object({ type: t.Literal("NOT_FOUND") }),
    t.Object({ type: t.Literal("EXPIRED") }),
  ]),

  totpError: t.Union([
    t.Object({ type: t.Literal("INVALID_CODE") }),
    t.Object({ type: t.Literal("ALREADY_ENABLED") }),
    t.Object({ type: t.Literal("NOT_ENABLED") }),
  ]),
};

export type RegisterBody = (typeof AuthModel.register)["static"];
export type LoginBody = (typeof AuthModel.login)["static"];
export type TotpCodeBody = (typeof AuthModel.totpCode)["static"];
export type VerifyEmailBody = (typeof AuthModel.verifyEmail)["static"];
export type ForgotPasswordBody = (typeof AuthModel.forgotPassword)["static"];
export type ResetPasswordBody = (typeof AuthModel.resetPassword)["static"];
export type ChangePasswordBody = (typeof AuthModel.changePassword)["static"];
export type OAuthCallbackQuery = (typeof AuthModel.oauthCallback)["static"];

export type SafeUser = (typeof AuthModel.safeUser)["static"];

export type RegisterError = (typeof AuthModel.registerError)["static"];
export type LoginError = (typeof AuthModel.loginError)["static"];
export type PasswordError = (typeof AuthModel.passwordError)["static"];
export type TokenError = (typeof AuthModel.tokenError)["static"];
export type OAuthError = (typeof AuthModel.oauthError)["static"];
export type OAuthUnlinkError = (typeof AuthModel.oauthUnlinkError)["static"];
export type DeleteAccountError =
  (typeof AuthModel.deleteAccountError)["static"];
export type SessionError = (typeof AuthModel.sessionError)["static"];
export type TotpError = (typeof AuthModel.totpError)["static"];

/**
 * Maps registration errors to RFC 9457 Problem Details.
 */
export function mapRegisterError(error: RegisterError, instance: string) {
  switch (error.type) {
    case "EMAIL_EXISTS":
      return conflict("Email already registered", { instance });
    case "WEAK_PASSWORD":
      return validationError(
        "Password does not meet requirements",
        error.requirements.map((r) => ({ field: "password", message: r })),
        { instance }
      );
  }
}

/**
 * Maps login errors to RFC 9457 Problem Details.
 * Note: REQUIRES_2FA is a special case that should be handled separately.
 */
export function mapLoginError(error: LoginError, instance: string) {
  switch (error.type) {
    case "INVALID_CREDENTIALS":
      return unauthorized("Invalid email or password", { instance });
    case "EMAIL_NOT_VERIFIED":
      return forbidden("Please verify your email before logging in", {
        instance,
      });
    case "ACCOUNT_LOCKED":
      return locked(error.unlockAt, { instance });
    case "REQUIRES_2FA":
      // This is not an error - it's a redirect flow
      return null;
  }
}

/**
 * Maps password change errors to RFC 9457 Problem Details.
 */
export function mapPasswordError(error: PasswordError, instance: string) {
  switch (error.type) {
    case "INCORRECT_PASSWORD":
      return unauthorized("Current password is incorrect", { instance });
    case "WEAK_PASSWORD":
      return validationError(
        "New password does not meet requirements",
        error.requirements.map((r) => ({ field: "newPassword", message: r })),
        { instance }
      );
    case "SAME_AS_CURRENT":
      return badRequest("New password must be different from current", {
        instance,
      });
  }
}

/**
 * Maps token errors to RFC 9457 Problem Details.
 */
export function mapTokenError(error: TokenError, instance: string) {
  switch (error.type) {
    case "INVALID_TOKEN":
      return badRequest("Invalid or expired token", { instance });
    case "EXPIRED_TOKEN":
      return badRequest("Token has expired", { instance });
  }
}

/**
 * Maps OAuth errors to RFC 9457 Problem Details.
 */
export function mapOAuthError(error: OAuthError, instance: string) {
  switch (error.type) {
    case "INVALID_STATE":
      return badRequest("Invalid OAuth state", { instance });
    case "TOKEN_EXCHANGE_FAILED":
      return serviceUnavailable("OAuth token exchange failed", { instance });
    case "PROFILE_FETCH_FAILED":
      return serviceUnavailable("Failed to fetch OAuth profile", { instance });
    case "ACCOUNT_ALREADY_LINKED":
      return conflict("This 42 account is already linked to another user", {
        instance,
      });
  }
}

/**
 * Maps OAuth unlink errors to RFC 9457 Problem Details.
 */
export function mapOAuthUnlinkError(error: OAuthUnlinkError, instance: string) {
  switch (error.type) {
    case "NOT_LINKED":
      return badRequest("No 42 account is linked to this user", { instance });
    case "PASSWORD_REQUIRED":
      return badRequest(
        "Password is required to unlink. OAuth-only accounts cannot unlink.",
        { instance }
      );
    case "INVALID_PASSWORD":
      return unauthorized("Invalid password", { instance });
  }
}

/**
 * Maps TOTP errors to RFC 9457 Problem Details.
 */
export function mapTotpError(error: TotpError, instance: string) {
  switch (error.type) {
    case "INVALID_CODE":
      return badRequest("Invalid verification code", { instance });
    case "ALREADY_ENABLED":
      return conflict("2FA is already enabled", { instance });
    case "NOT_ENABLED":
      return badRequest("2FA is not enabled", { instance });
  }
}

/**
 * Maps delete account errors to RFC 9457 Problem Details.
 */
export function mapDeleteAccountError(
  error: DeleteAccountError,
  instance: string
) {
  switch (error.type) {
    case "INVALID_PASSWORD":
      return unauthorized("Invalid password", { instance });
    case "OAUTH_ONLY_ACCOUNT":
      return badRequest(
        "Cannot delete OAuth-only account. Please set a password first or contact support.",
        { instance }
      );
  }
}
