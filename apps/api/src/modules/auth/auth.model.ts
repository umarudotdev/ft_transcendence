import { t } from "elysia";

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
export type SessionError = (typeof AuthModel.sessionError)["static"];
export type TotpError = (typeof AuthModel.totpError)["static"];
