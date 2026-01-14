import { generateState, OAuth2RequestError } from "arctic";
import { err, ok, ResultAsync } from "neverthrow";

import type {
  LoginError,
  OAuthError,
  PasswordError,
  RegisterError,
  SafeUser,
  SessionError,
  TotpError,
  TokenError,
} from "./auth.model";

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
  generateTotpSecret,
  secretToBase32,
  verifyTotpCode,
} from "./totp";

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Token durations
const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// Helper Functions
// =============================================================================

function toSafeUser(user: {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  intraId: number | null;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    intraId: user.intraId,
    createdAt: user.createdAt,
  };
}

// =============================================================================
// Auth Service
// =============================================================================

abstract class AuthService {
  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

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
        // Check if email already exists
        const existing = await authRepository.findUserByEmail(data.email);
        if (existing) {
          return err({ type: "EMAIL_EXISTS" as const });
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(data.password);
        if (!passwordValidation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: passwordValidation.requirements,
          });
        }

        // Hash the password
        const passwordHash = await hashPassword(data.password);

        // Create the user
        const user = await authRepository.createUser({
          email: data.email,
          passwordHash,
          displayName: data.displayName,
        });

        // Create email verification token
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_DURATION_MS);
        const token = await authRepository.createEmailVerificationToken(
          user.id,
          expiresAt
        );

        return ok({ user: toSafeUser(user), verificationToken: token.id });
      })(),
      () => ({ type: "EMAIL_EXISTS" as const }) // Fallback error
    ).andThen((result) => result);
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  static login(
    email: string,
    password: string
  ): ResultAsync<
    { sessionId: string; user: SafeUser; requires2fa: boolean },
    LoginError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        // Find user by email
        const user = await authRepository.findUserByEmail(email);

        // Generic error if user not found (prevents email enumeration)
        if (!user) {
          // Still hash to prevent timing attacks
          await hashPassword(password);
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return err({
            type: "ACCOUNT_LOCKED" as const,
            unlockAt: user.lockedUntil,
          });
        }

        // OAuth-only users don't have passwords
        if (!user.passwordHash) {
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        // Verify password
        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
          // Increment failed attempts
          await authRepository.incrementFailedLogins(user.id);
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        // Reset failed login counter on success
        await authRepository.resetFailedLogins(user.id);

        // Check if email is verified
        if (!user.emailVerified) {
          return err({ type: "EMAIL_NOT_VERIFIED" as const });
        }

        // If 2FA is enabled, return indicator that 2FA is required
        if (user.twoFactorEnabled) {
          return err({
            type: "REQUIRES_2FA" as const,
            userId: user.id,
          });
        }

        // Create session
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user.id, expiresAt);

        return ok({
          sessionId: session.id,
          user: toSafeUser(user),
          requires2fa: false,
        });
      })(),
      () => ({ type: "INVALID_CREDENTIALS" as const })
    ).andThen((result) => result);
  }

  // ---------------------------------------------------------------------------
  // Login with 2FA
  // ---------------------------------------------------------------------------

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

        // Verify TOTP code
        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        // Create session
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user.id, expiresAt);

        return ok({
          sessionId: session.id,
          user: toSafeUser(user),
        });
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  }

  // ---------------------------------------------------------------------------
  // Session Validation
  // ---------------------------------------------------------------------------

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
          // Clean up expired session
          await authRepository.deleteSession(sessionId);
          return err({ type: "EXPIRED" as const });
        }

        return ok(toSafeUser(session.user));
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  static logout(sessionId: string): ResultAsync<void, never> {
    return ResultAsync.fromPromise(
      authRepository.deleteSession(sessionId),
      () => undefined as never // logout never fails
    ).map(() => undefined);
  }

  static logoutAllDevices(userId: number): ResultAsync<void, never> {
    return ResultAsync.fromPromise(
      authRepository.deleteAllUserSessions(userId),
      () => undefined as never
    ).map(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Email Verification
  // ---------------------------------------------------------------------------

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

        // Mark email as verified
        await authRepository.updateEmailVerified(token.userId, true);

        // Delete the used token
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
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_DURATION_MS);
        const token = await authRepository.createEmailVerificationToken(
          userId,
          expiresAt
        );
        return { verificationToken: token.id };
      })(),
      // This should never fail, but if it does, return empty token
      (): never => {
        throw new Error("Unexpected error creating verification token");
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Password Reset
  // ---------------------------------------------------------------------------

  static requestPasswordReset(
    email: string
  ): ResultAsync<{ resetToken: string | null }, never> {
    // Always returns success to prevent email enumeration
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

        // Return null token if user doesn't exist (don't reveal this to caller)
        return { resetToken: null };
      })(),
      // Never fails, always returns ok with null token
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

        // Validate new password strength
        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: validation.requirements,
          });
        }

        // Hash and update password
        const passwordHash = await hashPassword(newPassword);
        await authRepository.updatePassword(token.userId, passwordHash);

        // Invalidate all existing sessions (security measure)
        await authRepository.deleteAllUserSessions(token.userId);

        // Delete the used token
        await authRepository.deletePasswordResetToken(tokenId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_TOKEN" as const })
    ).andThen((result) => result);
  }

  // ---------------------------------------------------------------------------
  // Change Password (for logged-in users)
  // ---------------------------------------------------------------------------

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

        // Verify current password
        const valid = await verifyPassword(currentPassword, user.passwordHash);
        if (!valid) {
          return err({ type: "INCORRECT_PASSWORD" as const });
        }

        // Check new password strength
        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: validation.requirements,
          });
        }

        // Check if new password is same as current
        const sameAsCurrent = await verifyPassword(
          newPassword,
          user.passwordHash
        );
        if (sameAsCurrent) {
          return err({ type: "SAME_AS_CURRENT" as const });
        }

        // Update password
        const passwordHash = await hashPassword(newPassword);
        await authRepository.updatePassword(userId, passwordHash);

        // Invalidate all other sessions
        await authRepository.deleteAllUserSessions(userId);

        return ok(undefined);
      })(),
      () => ({ type: "INCORRECT_PASSWORD" as const })
    ).andThen((result) => result);
  }

  // ---------------------------------------------------------------------------
  // OAuth
  // ---------------------------------------------------------------------------

  static generateOAuthUrl(): { url: string; state: string } | null {
    if (!fortyTwo) {
      return null;
    }

    // State prevents CSRF attacks
    // Store it in a cookie and verify on callback
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

        // Verify state to prevent CSRF
        if (storedState !== receivedState) {
          return err({ type: "INVALID_STATE" as const });
        }

        // Exchange code for tokens
        let tokens;
        try {
          tokens = await fortyTwo.validateAuthorizationCode(code);
        } catch (e) {
          if (e instanceof OAuth2RequestError) {
            return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
          }
          throw e;
        }

        // Fetch user profile from 42 API
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

        // Check if user with this 42 account exists
        let user = await authRepository.findUserByIntraId(intraId);
        let isNewUser = false;

        if (!user) {
          // Check if email is already registered
          const existingByEmail = await authRepository.findUserByEmail(email);

          if (existingByEmail) {
            // Link 42 account to existing user
            user = await authRepository.linkIntraAccount(
              existingByEmail.id,
              intraId
            );
          } else {
            // Create new user
            user = await authRepository.createUser({
              email,
              displayName,
              intraId,
              avatarUrl,
            });
            isNewUser = true;
          }
        }

        // Update avatar if provided and user doesn't have one
        if (avatarUrl && !user.avatarUrl) {
          await authRepository.updateAvatarUrl(user.id, avatarUrl);
        }

        // Create session
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user.id, expiresAt);

        return ok({
          sessionId: session.id,
          user: toSafeUser(user),
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

        // Verify state
        if (storedState !== receivedState) {
          return err({ type: "INVALID_STATE" as const });
        }

        // Check if user already has 42 linked
        const user = await authRepository.findUserById(userId);
        if (user?.intraId) {
          return err({ type: "ACCOUNT_ALREADY_LINKED" as const });
        }

        // Exchange code for tokens
        let tokens;
        try {
          tokens = await fortyTwo.validateAuthorizationCode(code);
        } catch {
          return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
        }

        // Fetch 42 profile
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

        // Check if this 42 account is already linked to another user
        const existingLink = await authRepository.findUserByIntraId(intraId);
        if (existingLink) {
          return err({ type: "ACCOUNT_ALREADY_LINKED" as const });
        }

        // Link the account
        await authRepository.linkIntraAccount(userId, intraId);

        return ok(undefined);
      })(),
      () => ({ type: "TOKEN_EXCHANGE_FAILED" as const })
    ).andThen((result) => result);
  }

  // ---------------------------------------------------------------------------
  // Two-Factor Authentication
  // ---------------------------------------------------------------------------

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

        // Generate new TOTP secret
        const { secret, keyUri } = generateTotpSecret(user.email);

        // Encrypt and store (but don't enable yet)
        const encryptedSecret = encryptSecret(secret);
        await authRepository.updateUserTotp(userId, encryptedSecret, false);

        return ok({
          qrCodeUrl: keyUri,
          secret: secretToBase32(secret), // For manual entry
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

        // Decrypt and verify the code
        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        // Enable 2FA
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

        // Verify code before disabling
        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        // Disable 2FA
        await authRepository.updateUserTotp(userId, null, false);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  }
}

export { AuthService };
