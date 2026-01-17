import { generateState, OAuth2RequestError } from "arctic";
import { err, ok, ResultAsync } from "neverthrow";

import type {
  ChangeEmailError,
  DeleteAccountError,
  LoginError,
  OAuthError,
  OAuthUnlinkError,
  PasswordError,
  RegisterError,
  SafeUser,
  SessionError,
  TotpError,
  TokenError,
} from "./auth.model";

import { logger } from "../../common/logger";
import { EmailService } from "../email/email.service";

const authLogger = logger.child("auth");
import { moderationRepository } from "../moderation/moderation.repository";
import { authRepository } from "./auth.repository";
import { fortyTwo, type IntraProfile, OAUTH_SCOPES } from "./oauth";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "./password";
import {
  decryptSecret,
  encryptSecret,
  generateQrCodeDataUrl,
  generateTotpSecret,
  secretToBase32,
  verifyTotpCode,
} from "./totp";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000;
const EMAIL_CHANGE_DURATION_MS = 60 * 60 * 1000; // 1 hour

async function toSafeUser(user: {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  intraId: number | null;
  createdAt: Date;
}): Promise<SafeUser> {
  const userRole = await moderationRepository.getUserRole(user.id);
  const role = (userRole?.role ?? "user") as "user" | "moderator" | "admin";

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    intraId: user.intraId,
    role,
    createdAt: user.createdAt,
  };
}

abstract class AuthService {
  static register(data: {
    email: string;
    password: string;
    displayName: string;
  }): ResultAsync<
    { user: SafeUser; verificationToken: string },
    RegisterError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const existing = await authRepository.findUserByEmail(data.email);
        if (existing) {
          return err({ type: "EMAIL_EXISTS" as const });
        }

        const passwordValidation = validatePasswordStrength(data.password);
        if (!passwordValidation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: passwordValidation.requirements,
          });
        }

        const passwordHash = await hashPassword(data.password);

        const user = await authRepository.createUser({
          email: data.email,
          passwordHash,
          displayName: data.displayName,
        });

        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_DURATION_MS);
        const token = await authRepository.createEmailVerificationToken(
          user.id,
          expiresAt
        );

        // Send verification email (fire and forget - don't fail registration if email fails)
        EmailService.sendVerificationEmail(
          user.email,
          token.id,
          user.displayName
        ).catch((error) =>
          authLogger.error(
            { action: "verification_email_failed", email: user.email },
            error instanceof Error ? error : new Error(String(error))
          )
        );

        return ok({
          user: await toSafeUser(user),
          verificationToken: token.id,
        });
      })(),
      () => ({ type: "EMAIL_EXISTS" as const })
    ).andThen((result) => result);
  }

  static login(
    email: string,
    password: string
  ): ResultAsync<
    { sessionId: string; user: SafeUser; requires2fa: boolean },
    LoginError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserByEmail(email);

        if (!user) {
          await hashPassword(password);
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return err({
            type: "ACCOUNT_LOCKED" as const,
            unlockAt: user.lockedUntil,
          });
        }

        if (!user.passwordHash) {
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
          await authRepository.incrementFailedLogins(user.id);
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        await authRepository.resetFailedLogins(user.id);

        if (!user.emailVerified) {
          return err({ type: "EMAIL_NOT_VERIFIED" as const });
        }

        if (user.twoFactorEnabled) {
          return err({
            type: "REQUIRES_2FA" as const,
            userId: user.id,
          });
        }

        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user.id, expiresAt);

        return ok({
          sessionId: session.id,
          user: await toSafeUser(user),
          requires2fa: false,
        });
      })(),
      () => ({ type: "INVALID_CREDENTIALS" as const })
    ).andThen((result) => result);
  }

  static loginWith2fa(
    userId: number,
    code: string
  ): ResultAsync<{ sessionId: string; user: SafeUser }, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.twoFactorEnabled || !user.totpSecret) {
          return err({ type: "NOT_ENABLED" as const });
        }

        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user.id, expiresAt);

        return ok({
          sessionId: session.id,
          user: await toSafeUser(user),
        });
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  }

  static validateSession(
    sessionId: string
  ): ResultAsync<SafeUser, SessionError> {
    return ResultAsync.fromPromise(
      (async () => {
        const session = await authRepository.findSessionById(sessionId);

        if (!session) {
          return err({ type: "NOT_FOUND" as const });
        }

        if (session.expiresAt < new Date()) {
          await authRepository.deleteSession(sessionId);
          return err({ type: "EXPIRED" as const });
        }

        return ok(await toSafeUser(session.user));
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  static logout(sessionId: string): ResultAsync<void, never> {
    return ResultAsync.fromPromise(
      authRepository.deleteSession(sessionId),
      () => undefined as never
    ).map(() => undefined);
  }

  static logoutAllDevices(userId: number): ResultAsync<void, never> {
    return ResultAsync.fromPromise(
      authRepository.deleteAllUserSessions(userId),
      () => undefined as never
    ).map(() => undefined);
  }

  static verifyEmail(tokenId: string): ResultAsync<void, TokenError> {
    return ResultAsync.fromPromise(
      (async () => {
        const token = await authRepository.findEmailVerificationToken(tokenId);

        if (!token) {
          return err({ type: "INVALID_TOKEN" as const });
        }

        if (token.expiresAt < new Date()) {
          await authRepository.deleteEmailVerificationToken(tokenId);
          return err({ type: "EXPIRED_TOKEN" as const });
        }

        await authRepository.updateEmailVerified(token.userId, true);

        await authRepository.deleteEmailVerificationToken(tokenId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_TOKEN" as const })
    ).andThen((result) => result);
  }

  static resendVerificationEmail(
    userId: number
  ): ResultAsync<{ verificationToken: string }, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);
        if (!user) {
          throw new Error("User not found");
        }

        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_DURATION_MS);
        const token = await authRepository.createEmailVerificationToken(
          userId,
          expiresAt
        );

        // Send verification email
        EmailService.sendVerificationEmail(
          user.email,
          token.id,
          user.displayName
        ).catch((error) =>
          authLogger.error(
            { action: "verification_email_failed", email: user.email },
            error instanceof Error ? error : new Error(String(error))
          )
        );

        return { verificationToken: token.id };
      })(),

      (): never => {
        throw new Error("Unexpected error creating verification token");
      }
    );
  }

  static requestPasswordReset(
    email: string
  ): ResultAsync<{ resetToken: string | null }, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserByEmail(email);

        if (user) {
          const expiresAt = new Date(Date.now() + PASSWORD_RESET_DURATION_MS);
          const token = await authRepository.createPasswordResetToken(
            user.id,
            expiresAt
          );
          return { resetToken: token.id };
        }

        return { resetToken: null };
      })(),

      (): never => {
        throw new Error("Unexpected error in password reset");
      }
    );
  }

  static resetPassword(
    tokenId: string,
    newPassword: string
  ): ResultAsync<void, TokenError | PasswordError> {
    return ResultAsync.fromPromise(
      (async () => {
        const token = await authRepository.findPasswordResetToken(tokenId);

        if (!token) {
          return err({ type: "INVALID_TOKEN" as const });
        }

        if (token.expiresAt < new Date()) {
          await authRepository.deletePasswordResetToken(tokenId);
          return err({ type: "EXPIRED_TOKEN" as const });
        }

        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: validation.requirements,
          });
        }

        const passwordHash = await hashPassword(newPassword);
        await authRepository.updatePassword(token.userId, passwordHash);

        await authRepository.deleteAllUserSessions(token.userId);

        await authRepository.deletePasswordResetToken(tokenId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_TOKEN" as const })
    ).andThen((result) => result);
  }

  static changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): ResultAsync<void, PasswordError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.passwordHash) {
          return err({ type: "INCORRECT_PASSWORD" as const });
        }

        const valid = await verifyPassword(currentPassword, user.passwordHash);
        if (!valid) {
          return err({ type: "INCORRECT_PASSWORD" as const });
        }

        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: validation.requirements,
          });
        }

        const sameAsCurrent = await verifyPassword(
          newPassword,
          user.passwordHash
        );
        if (sameAsCurrent) {
          return err({ type: "SAME_AS_CURRENT" as const });
        }

        const passwordHash = await hashPassword(newPassword);
        await authRepository.updatePassword(userId, passwordHash);

        await authRepository.deleteAllUserSessions(userId);

        return ok(undefined);
      })(),
      () => ({ type: "INCORRECT_PASSWORD" as const })
    ).andThen((result) => result);
  }

  static requestEmailChange(
    userId: number,
    newEmail: string,
    password: string
  ): ResultAsync<{ token: string }, ChangeEmailError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user) {
          return err({ type: "INCORRECT_PASSWORD" as const });
        }

        // OAuth-only accounts cannot change email
        if (!user.passwordHash) {
          return err({ type: "OAUTH_ONLY_ACCOUNT" as const });
        }

        // Verify current password
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return err({ type: "INCORRECT_PASSWORD" as const });
        }

        // Check if new email is different
        if (newEmail.toLowerCase() === user.email.toLowerCase()) {
          return err({ type: "SAME_EMAIL" as const });
        }

        // Check if new email is already in use
        const existingUser = await authRepository.findUserByEmail(newEmail);
        if (existingUser) {
          return err({ type: "EMAIL_EXISTS" as const });
        }

        // Create token with pending email
        // Note: This deletes any existing email verification tokens for this user,
        // but that's acceptable since users can only change email after verifying
        // their initial email (enforced by authGuard requiring a valid session)
        const expiresAt = new Date(Date.now() + EMAIL_CHANGE_DURATION_MS);
        const token = await authRepository.createEmailChangeToken(
          userId,
          newEmail.toLowerCase(),
          expiresAt
        );

        // Send verification email to NEW address (fire and forget)
        EmailService.sendEmailChangeVerification(
          newEmail,
          token.id,
          user.displayName
        ).catch((error) =>
          authLogger.error(
            { action: "email_change_verification_failed", newEmail },
            error instanceof Error ? error : new Error(String(error))
          )
        );

        return ok({ token: token.id });
      })(),
      () => ({ type: "INCORRECT_PASSWORD" as const })
    ).andThen((result) => result);
  }

  static verifyEmailChange(tokenId: string): ResultAsync<void, TokenError> {
    return ResultAsync.fromPromise(
      (async () => {
        const token = await authRepository.findEmailChangeToken(tokenId);

        if (!token || !token.pendingEmail) {
          return err({ type: "INVALID_TOKEN" as const });
        }

        if (token.expiresAt < new Date()) {
          await authRepository.deleteEmailVerificationToken(tokenId);
          return err({ type: "EXPIRED_TOKEN" as const });
        }

        // Try to update email - the database unique constraint will prevent
        // race conditions where another user takes this email between check and update
        const updated = await authRepository.updateEmail(
          token.userId,
          token.pendingEmail
        );

        // If update failed (e.g., unique constraint violation), the repository
        // returns null, which we handle as an invalid token
        if (!updated) {
          await authRepository.deleteEmailVerificationToken(tokenId);
          return err({ type: "INVALID_TOKEN" as const });
        }

        // Invalidate all sessions (force re-login with new email)
        await authRepository.deleteAllUserSessions(token.userId);

        // Delete token
        await authRepository.deleteEmailVerificationToken(tokenId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_TOKEN" as const })
    ).andThen((result) => result);
  }

  static generateOAuthUrl(): { url: string; state: string } | null {
    if (!fortyTwo) {
      return null;
    }

    const state = generateState();
    const url = fortyTwo.createAuthorizationURL(state, OAUTH_SCOPES);

    return { url: url.toString(), state };
  }

  static handleOAuthCallback(
    code: string,
    storedState: string,
    receivedState: string
  ): ResultAsync<
    { sessionId: string; user: SafeUser; isNewUser: boolean },
    OAuthError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        if (!fortyTwo) {
          return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
        }

        if (storedState !== receivedState) {
          return err({ type: "INVALID_STATE" as const });
        }

        let tokens;
        try {
          tokens = await fortyTwo.validateAuthorizationCode(code);
        } catch (e) {
          if (e instanceof OAuth2RequestError) {
            return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
          }
          throw e;
        }

        let profile: IntraProfile;
        try {
          const response = await fetch("https://api.intra.42.fr/v2/me", {
            headers: {
              Authorization: `Bearer ${tokens.accessToken()}`,
            },
          });

          if (!response.ok) {
            return err({ type: "PROFILE_FETCH_FAILED" as const });
          }

          profile = (await response.json()) as IntraProfile;
        } catch {
          return err({ type: "PROFILE_FETCH_FAILED" as const });
        }

        const intraId = profile.id;
        const email = profile.email;
        const displayName = profile.login;
        const avatarUrl = profile.image?.link;

        let user = await authRepository.findUserByIntraId(intraId);
        let isNewUser = false;

        if (!user) {
          const existingByEmail = await authRepository.findUserByEmail(email);

          if (existingByEmail) {
            user = await authRepository.linkIntraAccount(
              existingByEmail.id,
              intraId
            );
          } else {
            user = await authRepository.createUser({
              email,
              displayName,
              intraId,
              avatarUrl,
            });
            isNewUser = true;
          }
        }

        if (avatarUrl && !user.avatarUrl) {
          await authRepository.updateAvatarUrl(user.id, avatarUrl);
        }

        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user.id, expiresAt);

        return ok({
          sessionId: session.id,
          user: await toSafeUser(user),
          isNewUser,
        });
      })(),
      () => ({ type: "TOKEN_EXCHANGE_FAILED" as const })
    ).andThen((result) => result);
  }

  static linkOAuthAccount(
    userId: number,
    code: string,
    storedState: string,
    receivedState: string
  ): ResultAsync<void, OAuthError> {
    return ResultAsync.fromPromise(
      (async () => {
        if (!fortyTwo) {
          return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
        }

        if (storedState !== receivedState) {
          return err({ type: "INVALID_STATE" as const });
        }

        const user = await authRepository.findUserById(userId);
        if (user?.intraId) {
          return err({ type: "ACCOUNT_ALREADY_LINKED" as const });
        }

        let tokens;
        try {
          tokens = await fortyTwo.validateAuthorizationCode(code);
        } catch {
          return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
        }

        const response = await fetch("https://api.intra.42.fr/v2/me", {
          headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
          },
        });

        if (!response.ok) {
          return err({ type: "PROFILE_FETCH_FAILED" as const });
        }

        const profile = (await response.json()) as IntraProfile;
        const intraId = profile.id;

        const existingLink = await authRepository.findUserByIntraId(intraId);
        if (existingLink) {
          return err({ type: "ACCOUNT_ALREADY_LINKED" as const });
        }

        await authRepository.linkIntraAccount(userId, intraId);

        return ok(undefined);
      })(),
      () => ({ type: "TOKEN_EXCHANGE_FAILED" as const })
    ).andThen((result) => result);
  }

  static unlinkOAuthAccount(
    userId: number,
    password: string
  ): ResultAsync<void, OAuthUnlinkError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user?.intraId) {
          return err({ type: "NOT_LINKED" as const });
        }

        // Users who signed up via OAuth and never set a password cannot unlink
        if (!user.passwordHash) {
          return err({ type: "PASSWORD_REQUIRED" as const });
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return err({ type: "INVALID_PASSWORD" as const });
        }

        await authRepository.unlinkIntraAccount(userId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_PASSWORD" as const })
    ).andThen((result) => result);
  }

  static enableTotp(
    userId: number
  ): ResultAsync<{ qrCodeUrl: string; secret: string }, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user) {
          return err({ type: "NOT_ENABLED" as const });
        }

        if (user.twoFactorEnabled) {
          return err({ type: "ALREADY_ENABLED" as const });
        }

        const { secret, keyUri } = generateTotpSecret(user.email);

        const encryptedSecret = encryptSecret(secret);
        await authRepository.updateUserTotp(userId, encryptedSecret, false);

        const qrCodeDataUrl = await generateQrCodeDataUrl(keyUri);

        return ok({
          qrCodeUrl: qrCodeDataUrl,
          secret: secretToBase32(secret),
        });
      })(),
      () => ({ type: "NOT_ENABLED" as const })
    ).andThen((result) => result);
  }

  static confirmTotp(
    userId: number,
    code: string
  ): ResultAsync<void, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.totpSecret) {
          return err({ type: "NOT_ENABLED" as const });
        }

        if (user.twoFactorEnabled) {
          return err({ type: "ALREADY_ENABLED" as const });
        }

        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        await authRepository.updateUserTotp(userId, user.totpSecret, true);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  }

  static verifyTotp(
    userId: number,
    code: string
  ): ResultAsync<void, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.twoFactorEnabled || !user.totpSecret) {
          return err({ type: "NOT_ENABLED" as const });
        }

        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  }

  static disableTotp(
    userId: number,
    code: string
  ): ResultAsync<void, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.twoFactorEnabled || !user.totpSecret) {
          return err({ type: "NOT_ENABLED" as const });
        }

        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        await authRepository.updateUserTotp(userId, null, false);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  }

  static deleteAccount(
    userId: number,
    password: string
  ): ResultAsync<void, DeleteAccountError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user) {
          return err({ type: "INVALID_PASSWORD" as const });
        }

        // OAuth-only accounts cannot delete themselves (no password to verify)
        if (!user.passwordHash) {
          return err({ type: "OAUTH_ONLY_ACCOUNT" as const });
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return err({ type: "INVALID_PASSWORD" as const });
        }

        // Delete all sessions first
        await authRepository.deleteAllUserSessions(userId);

        // Create audit log entry before deletion
        await moderationRepository.createAuditLogEntry({
          actorId: userId,
          action: "SELF_DELETE_ACCOUNT",
          targetUserId: userId,
          details: `User ${user.email} deleted their own account`,
        });

        // Delete the user (cascade deletion handles related records)
        await moderationRepository.deleteUser(userId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_PASSWORD" as const })
    ).andThen((result) => result);
  }
}

export { AuthService };
