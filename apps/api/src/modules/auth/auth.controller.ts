import { Elysia } from "elysia";

import { authGuard } from "../../common/guards/auth.macro";
import { rateLimit } from "../../common/plugins/rate-limit";
import { env } from "../../env";
import { AuthModel } from "./auth.model";
import { AuthService } from "./auth.service";

const isProduction = env.NODE_ENV === "production";

// Cookie configuration for sessions
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true, // Not accessible via JavaScript
  secure: isProduction, // HTTPS only in production
  sameSite: "lax" as const, // CSRF protection
  path: "/", // Available on all paths
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

// OAuth state cookie options (shorter-lived)
const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60, // 10 minutes
};

export const authController = new Elysia({ prefix: "/auth" })

  // ===========================================================================
  // RATE-LIMITED PUBLIC ROUTES (isolated in groups to prevent cascade)
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Registration (rate limited: 3/hour)
  // ---------------------------------------------------------------------------
  .group("", (app) =>
    app.use(rateLimit({ max: 3, window: 60 * 60 * 1000 })).post(
      "/register",
      async ({ body, set }) => {
        const result = await AuthService.register(body);

        if (result.isErr()) {
          const err = result.error;
          if (err.type === "EMAIL_EXISTS") {
            set.status = 409;
            return { message: "Email already registered" };
          }
          // Must be WEAK_PASSWORD
          set.status = 400;
          return {
            message: "Password too weak",
            requirements: err.requirements,
          };
        }

        // In production, send verification email
        // For now, return the token for testing purposes
        const { user, verificationToken } = result.value;
        return {
          message: "Registration successful. Please verify your email.",
          user,
          // TODO: Remove in production - send via email instead
          verificationToken: !isProduction ? verificationToken : undefined,
        };
      },
      {
        body: AuthModel.register,
      }
    )
  )

  // ---------------------------------------------------------------------------
  // Login (rate limited: 5/15min)
  // ---------------------------------------------------------------------------
  .group("", (app) =>
    app.use(rateLimit({ max: 5, window: 15 * 60 * 1000 })).post(
      "/login",
      async ({ body, cookie, set }) => {
        const result = await AuthService.login(body.email, body.password);

        if (result.isErr()) {
          const err = result.error;
          if (err.type === "INVALID_CREDENTIALS") {
            set.status = 401;
            return { message: "Invalid email or password" };
          }
          if (err.type === "EMAIL_NOT_VERIFIED") {
            set.status = 403;
            return { message: "Please verify your email before logging in" };
          }
          if (err.type === "ACCOUNT_LOCKED") {
            set.status = 423;
            return {
              message: "Account locked due to too many failed attempts",
              unlockAt: err.unlockAt.toISOString(),
            };
          }
          // Must be REQUIRES_2FA
          // Store user ID temporarily for 2FA verification
          cookie.pending_2fa.set({
            value: String(err.userId),
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: 5 * 60, // 5 minutes to complete 2FA
          });
          return {
            message: "2FA required",
            requires2fa: true,
          };
        }

        const { sessionId, user } = result.value;

        // Set session cookie
        cookie.session.set({
          value: sessionId,
          ...SESSION_COOKIE_OPTIONS,
        });

        return {
          message: "Login successful",
          user,
        };
      },
      {
        body: AuthModel.login,
      }
    )
  )

  // ---------------------------------------------------------------------------
  // 2FA Verification (during login) - shares login rate limit via group
  // ---------------------------------------------------------------------------
  .group("", (app) =>
    app.use(rateLimit({ max: 5, window: 15 * 60 * 1000 })).post(
      "/2fa/login",
      async ({ body, cookie, set }) => {
        const pendingUserId = cookie.pending_2fa?.value;

        if (!pendingUserId) {
          set.status = 400;
          return { message: "No pending 2FA session" };
        }

        const userId = Number.parseInt(String(pendingUserId), 10);
        if (Number.isNaN(userId)) {
          cookie.pending_2fa.remove();
          set.status = 400;
          return { message: "Invalid 2FA session" };
        }

        const result = await AuthService.loginWith2fa(userId, body.code);

        // Clear pending 2FA cookie regardless of result
        cookie.pending_2fa.remove();

        if (result.isErr()) {
          set.status = 400;
          return { message: "Invalid 2FA code" };
        }

        const { sessionId, user } = result.value;

        // Set session cookie
        cookie.session.set({
          value: sessionId,
          ...SESSION_COOKIE_OPTIONS,
        });

        return {
          message: "Login successful",
          user,
        };
      },
      {
        body: AuthModel.totpCode,
      }
    )
  )

  // ---------------------------------------------------------------------------
  // Email Verification (no rate limit needed - tokens are one-time use)
  // ---------------------------------------------------------------------------
  .post(
    "/verify-email",
    async ({ body, set }) => {
      const result = await AuthService.verifyEmail(body.token);

      if (result.isErr()) {
        const err = result.error;
        set.status = 400;
        if (err.type === "INVALID_TOKEN") {
          return { message: "Invalid verification token" };
        }
        if (err.type === "EXPIRED_TOKEN") {
          return { message: "Verification token has expired" };
        }
      }

      return { message: "Email verified successfully" };
    },
    {
      body: AuthModel.verifyEmail,
    }
  )

  // ---------------------------------------------------------------------------
  // Forgot Password (rate limited: 3/hour)
  // ---------------------------------------------------------------------------
  .group("", (app) =>
    app.use(rateLimit({ max: 3, window: 60 * 60 * 1000 })).post(
      "/forgot-password",
      async ({ body }) => {
        // Always returns success to prevent email enumeration
        const result = await AuthService.requestPasswordReset(body.email);

        // In production, send email with reset link
        // For development, log the token
        if (result.isOk() && result.value.resetToken && !isProduction) {
          console.log(
            `Password reset token for ${body.email}: ${result.value.resetToken}`
          );
        }

        return {
          message: "If an account exists, a password reset email has been sent",
        };
      },
      {
        body: AuthModel.forgotPassword,
      }
    )
  )

  // ---------------------------------------------------------------------------
  // Reset Password (rate limited: 5/hour)
  // ---------------------------------------------------------------------------
  .group("", (app) =>
    app.use(rateLimit({ max: 5, window: 60 * 60 * 1000 })).post(
      "/reset-password",
      async ({ body, set }) => {
        const result = await AuthService.resetPassword(
          body.token,
          body.password
        );

        if (result.isErr()) {
          const err = result.error;
          set.status = 400;
          if (err.type === "INVALID_TOKEN") {
            return { message: "Invalid or expired reset token" };
          }
          if (err.type === "EXPIRED_TOKEN") {
            return { message: "Reset token has expired" };
          }
          if (err.type === "WEAK_PASSWORD") {
            return {
              message: "Password too weak",
              requirements: err.requirements,
            };
          }
        }

        return { message: "Password reset successfully" };
      },
      {
        body: AuthModel.resetPassword,
      }
    )
  )

  // ---------------------------------------------------------------------------
  // OAuth: Initiate 42 Login (no rate limit - redirects to external)
  // ---------------------------------------------------------------------------
  .get("/42", ({ cookie, set }) => {
    const result = AuthService.generateOAuthUrl();

    if (!result) {
      set.status = 503;
      return { message: "OAuth is not configured" };
    }

    const { url, state } = result;

    // Store state in cookie for CSRF protection
    cookie.oauth_state.set({
      value: state,
      ...OAUTH_STATE_COOKIE_OPTIONS,
    });

    // Redirect to 42
    set.redirect = url;
    return { message: "Redirecting to 42 OAuth" };
  })

  // ---------------------------------------------------------------------------
  // OAuth: Handle 42 Callback
  // ---------------------------------------------------------------------------
  .get(
    "/42/callback",
    async ({ query, cookie, set }) => {
      const code = query.code;
      const state = query.state;
      const storedState = cookie.oauth_state?.value;

      // Clear the state cookie
      cookie.oauth_state.remove();

      if (!code || !state || !storedState) {
        // Redirect to frontend with error
        set.redirect = `${env.FRONTEND_URL}/auth/login?error=invalid_oauth`;
        return { message: "Redirecting with error" };
      }

      const result = await AuthService.handleOAuthCallback(
        code,
        String(storedState),
        state
      );

      if (result.isErr()) {
        const err = result.error;
        // Redirect to frontend with error
        set.redirect = `${env.FRONTEND_URL}/auth/login?error=${err.type.toLowerCase()}`;
        return { message: "Redirecting with error" };
      }

      const { sessionId, isNewUser } = result.value;

      // Set session cookie
      cookie.session.set({
        value: sessionId,
        ...SESSION_COOKIE_OPTIONS,
      });

      // Redirect to frontend
      const redirectUrl = isNewUser
        ? `${env.FRONTEND_URL}/welcome`
        : `${env.FRONTEND_URL}/`;

      set.redirect = redirectUrl;
      return { message: "Redirecting to app" };
    },
    {
      query: AuthModel.oauthCallback,
    }
  )

  // ===========================================================================
  // PROTECTED ROUTES (Authentication required)
  // ===========================================================================
  .use(authGuard)

  // ---------------------------------------------------------------------------
  // Get Current User
  // ---------------------------------------------------------------------------
  .get("/me", ({ user }) => {
    return { user };
  })

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  .post("/logout", async ({ cookie }) => {
    const sessionId = cookie.session?.value;
    if (sessionId) {
      await AuthService.logout(String(sessionId));
    }
    cookie.session.remove();
    return { message: "Logged out successfully" };
  })

  // ---------------------------------------------------------------------------
  // Logout All Devices
  // ---------------------------------------------------------------------------
  .post("/logout-all", async ({ user, cookie }) => {
    await AuthService.logoutAllDevices(user.id);
    cookie.session.remove();
    return { message: "Logged out from all devices" };
  })

  // ---------------------------------------------------------------------------
  // Resend Verification Email
  // ---------------------------------------------------------------------------
  .post("/resend-verification", async ({ user }) => {
    const result = await AuthService.resendVerificationEmail(user.id);

    // In production, send email
    // For development, return token
    return {
      message: "Verification email sent",
      // TODO: Remove in production
      verificationToken:
        !isProduction && result.isOk()
          ? result.value.verificationToken
          : undefined,
    };
  })

  // ---------------------------------------------------------------------------
  // Change Password
  // ---------------------------------------------------------------------------
  .post(
    "/change-password",
    async ({ body, user, cookie, set }) => {
      const result = await AuthService.changePassword(
        user.id,
        body.currentPassword,
        body.newPassword
      );

      if (result.isErr()) {
        const err = result.error;
        if (err.type === "INCORRECT_PASSWORD") {
          set.status = 401;
          return { message: "Current password is incorrect" };
        }
        if (err.type === "WEAK_PASSWORD") {
          set.status = 400;
          return {
            message: "New password too weak",
            requirements: err.requirements,
          };
        }
        if (err.type === "SAME_AS_CURRENT") {
          set.status = 400;
          return { message: "New password must be different from current" };
        }
      }

      // Clear session cookie (all sessions invalidated)
      cookie.session.remove();

      return { message: "Password changed successfully. Please log in again." };
    },
    {
      body: AuthModel.changePassword,
    }
  )

  // ---------------------------------------------------------------------------
  // Link 42 Account
  // ---------------------------------------------------------------------------
  .get("/42/link", ({ cookie, set }) => {
    const result = AuthService.generateOAuthUrl();

    if (!result) {
      set.status = 503;
      return { message: "OAuth is not configured" };
    }

    const { url, state } = result;

    // Store state with "link" prefix to distinguish from login
    cookie.oauth_state.set({
      value: `link:${state}`,
      ...OAUTH_STATE_COOKIE_OPTIONS,
    });

    // Redirect to 42
    set.redirect = url;
    return { message: "Redirecting to 42 OAuth" };
  })

  .get(
    "/42/link/callback",
    async ({ query, cookie, user, set }) => {
      const code = query.code;
      const state = query.state;
      const storedState = cookie.oauth_state?.value;

      // Clear the state cookie
      cookie.oauth_state.remove();

      if (!code || !state || !storedState) {
        set.redirect = `${env.FRONTEND_URL}/settings/security?error=invalid_oauth`;
        return { message: "Redirecting with error" };
      }

      // Extract actual state (remove "link:" prefix)
      const actualStoredState = String(storedState).replace("link:", "");

      const result = await AuthService.linkOAuthAccount(
        user.id,
        code,
        actualStoredState,
        state
      );

      if (result.isErr()) {
        const err = result.error;
        set.redirect = `${env.FRONTEND_URL}/settings/security?error=${err.type.toLowerCase()}`;
        return { message: "Redirecting with error" };
      }

      set.redirect = `${env.FRONTEND_URL}/settings/security?success=42_linked`;
      return { message: "Redirecting to settings" };
    },
    {
      query: AuthModel.oauthCallback,
    }
  )

  // ---------------------------------------------------------------------------
  // 2FA: Enable (Step 1 - Generate)
  // ---------------------------------------------------------------------------
  .post("/2fa/enable", async ({ user, set }) => {
    const result = await AuthService.enableTotp(user.id);

    if (result.isErr()) {
      const err = result.error;
      if (err.type === "ALREADY_ENABLED") {
        set.status = 409;
        return { message: "2FA is already enabled" };
      }
      set.status = 400;
      return { message: "Failed to enable 2FA" };
    }

    return {
      message: "Scan the QR code with your authenticator app",
      qrCodeUrl: result.value.qrCodeUrl,
      secret: result.value.secret, // For manual entry
    };
  })

  // ---------------------------------------------------------------------------
  // 2FA: Confirm (Step 2 - Verify and Activate)
  // ---------------------------------------------------------------------------
  .post(
    "/2fa/verify",
    async ({ body, user, set }) => {
      const result = await AuthService.confirmTotp(user.id, body.code);

      if (result.isErr()) {
        const err = result.error;
        if (err.type === "INVALID_CODE") {
          set.status = 400;
          return { message: "Invalid verification code" };
        }
        if (err.type === "ALREADY_ENABLED") {
          set.status = 409;
          return { message: "2FA is already enabled" };
        }
        set.status = 400;
        return { message: "Failed to confirm 2FA" };
      }

      return { message: "2FA enabled successfully" };
    },
    {
      body: AuthModel.totpCode,
    }
  )

  // ---------------------------------------------------------------------------
  // 2FA: Disable
  // ---------------------------------------------------------------------------
  .post(
    "/2fa/disable",
    async ({ body, user, set }) => {
      const result = await AuthService.disableTotp(user.id, body.code);

      if (result.isErr()) {
        const err = result.error;
        if (err.type === "INVALID_CODE") {
          set.status = 400;
          return { message: "Invalid verification code" };
        }
        if (err.type === "NOT_ENABLED") {
          set.status = 400;
          return { message: "2FA is not enabled" };
        }
      }

      return { message: "2FA disabled successfully" };
    },
    {
      body: AuthModel.totpCode,
    }
  );
