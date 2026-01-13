import { Elysia, t } from "elysia";

import { authGuard } from "../../common/guards/auth.guard";
import { rateLimit } from "../../common/plugins/rate-limit";
import { authService } from "./auth.service";

// Cookie configuration for sessions
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true, // Not accessible via JavaScript
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "lax" as const, // CSRF protection
  path: "/", // Available on all paths
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

// OAuth state cookie options (shorter-lived)
const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60, // 10 minutes
};

// Frontend URL for redirects
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

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
        const result = await authService.register(body);

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
          verificationToken:
            process.env.NODE_ENV !== "production"
              ? verificationToken
              : undefined,
        };
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String({ minLength: 8 }),
          displayName: t.String({ minLength: 3, maxLength: 30 }),
        }),
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
        const result = await authService.login(body.email, body.password);

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
            secure: process.env.NODE_ENV === "production",
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
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String({ minLength: 1 }),
        }),
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

        const result = await authService.loginWith2fa(userId, body.code);

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
        body: t.Object({
          code: t.String({ pattern: "^[0-9]{6}$" }), // 6-digit code
        }),
      }
    )
  )

  // ---------------------------------------------------------------------------
  // Email Verification (no rate limit needed - tokens are one-time use)
  // ---------------------------------------------------------------------------
  .post(
    "/verify-email",
    async ({ body, set }) => {
      const result = await authService.verifyEmail(body.token);

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
      body: t.Object({
        token: t.String(),
      }),
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
        const result = await authService.requestPasswordReset(body.email);

        // In production, send email with reset link
        // For development, log the token
        if (
          result.isOk() &&
          result.value.resetToken &&
          process.env.NODE_ENV !== "production"
        ) {
          console.log(
            `Password reset token for ${body.email}: ${result.value.resetToken}`
          );
        }

        return {
          message: "If an account exists, a password reset email has been sent",
        };
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
        }),
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
        const result = await authService.resetPassword(
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
        body: t.Object({
          token: t.String(),
          password: t.String({ minLength: 8 }),
        }),
      }
    )
  )

  // ---------------------------------------------------------------------------
  // OAuth: Initiate 42 Login (no rate limit - redirects to external)
  // ---------------------------------------------------------------------------
  .get("/42", ({ cookie, set }) => {
    const result = authService.generateOAuthUrl();

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
        set.redirect = `${FRONTEND_URL}/auth/login?error=invalid_oauth`;
        return { message: "Redirecting with error" };
      }

      const result = await authService.handleOAuthCallback(
        code,
        String(storedState),
        state
      );

      if (result.isErr()) {
        const err = result.error;
        // Redirect to frontend with error
        set.redirect = `${FRONTEND_URL}/auth/login?error=${err.type.toLowerCase()}`;
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
        ? `${FRONTEND_URL}/welcome`
        : `${FRONTEND_URL}/`;

      set.redirect = redirectUrl;
      return { message: "Redirecting to app" };
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
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
      await authService.logout(String(sessionId));
    }
    cookie.session.remove();
    return { message: "Logged out successfully" };
  })

  // ---------------------------------------------------------------------------
  // Logout All Devices
  // ---------------------------------------------------------------------------
  .post("/logout-all", async ({ user, cookie }) => {
    await authService.logoutAllDevices(user.id);
    cookie.session.remove();
    return { message: "Logged out from all devices" };
  })

  // ---------------------------------------------------------------------------
  // Resend Verification Email
  // ---------------------------------------------------------------------------
  .post("/resend-verification", async ({ user }) => {
    const result = await authService.resendVerificationEmail(user.id);

    // In production, send email
    // For development, return token
    return {
      message: "Verification email sent",
      // TODO: Remove in production
      verificationToken:
        process.env.NODE_ENV !== "production" && result.isOk()
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
      const result = await authService.changePassword(
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
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String({ minLength: 8 }),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Link 42 Account
  // ---------------------------------------------------------------------------
  .get("/42/link", ({ cookie, set }) => {
    const result = authService.generateOAuthUrl();

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
        set.redirect = `${FRONTEND_URL}/settings/security?error=invalid_oauth`;
        return { message: "Redirecting with error" };
      }

      // Extract actual state (remove "link:" prefix)
      const actualStoredState = String(storedState).replace("link:", "");

      const result = await authService.linkOAuthAccount(
        user.id,
        code,
        actualStoredState,
        state
      );

      if (result.isErr()) {
        const err = result.error;
        set.redirect = `${FRONTEND_URL}/settings/security?error=${err.type.toLowerCase()}`;
        return { message: "Redirecting with error" };
      }

      set.redirect = `${FRONTEND_URL}/settings/security?success=42_linked`;
      return { message: "Redirecting to settings" };
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // 2FA: Enable (Step 1 - Generate)
  // ---------------------------------------------------------------------------
  .post("/2fa/enable", async ({ user, set }) => {
    const result = await authService.enableTotp(user.id);

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
      const result = await authService.confirmTotp(user.id, body.code);

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
      body: t.Object({
        code: t.String({ pattern: "^[0-9]{6}$" }), // 6-digit code
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // 2FA: Disable
  // ---------------------------------------------------------------------------
  .post(
    "/2fa/disable",
    async ({ body, user, set }) => {
      const result = await authService.disableTotp(user.id, body.code);

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
      body: t.Object({
        code: t.String({ pattern: "^[0-9]{6}$" }),
      }),
    }
  );
