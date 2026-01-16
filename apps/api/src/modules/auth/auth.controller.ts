import { Elysia } from "elysia";

import {
  HttpStatus,
  badRequest,
  serviceUnavailable,
} from "../../common/errors";
import { authGuard } from "../../common/guards/auth.macro";
import { rateLimit } from "../../common/plugins/rate-limit";
import { env } from "../../env";
import {
  AuthModel,
  mapLoginError,
  mapOAuthUnlinkError,
  mapPasswordError,
  mapRegisterError,
  mapTokenError,
  mapTotpError,
} from "./auth.model";
import { AuthService } from "./auth.service";

const isProduction = env.NODE_ENV === "production";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
};

const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export const authController = new Elysia({ prefix: "/auth" })
  .group("", (app) =>
    app.use(rateLimit({ max: 3, window: 60 * 60 * 1000 })).post(
      "/register",
      async ({ body, request, set }) => {
        const instance = new URL(request.url).pathname;
        const result = await AuthService.register(body);

        return result.match(
          ({ user, verificationToken }) => ({
            message: "Registration successful. Please verify your email.",
            user,
            verificationToken: !isProduction ? verificationToken : undefined,
          }),
          (error) => {
            const problem = mapRegisterError(error, instance);
            set.status = problem.status;
            set.headers["Content-Type"] = "application/problem+json";
            return problem;
          }
        );
      },
      {
        body: AuthModel.register,
      }
    )
  )
  .group("", (app) =>
    app.use(rateLimit({ max: 5, window: 15 * 60 * 1000 })).post(
      "/login",
      async ({ body, cookie, request, set }) => {
        const instance = new URL(request.url).pathname;
        const result = await AuthService.login(body.email, body.password);

        return result.match(
          ({ sessionId, user }) => {
            cookie.session.set({
              value: sessionId,
              ...SESSION_COOKIE_OPTIONS,
            });
            return {
              message: "Login successful",
              user,
            };
          },
          (error) => {
            // Handle 2FA flow separately - it's not an error
            if (error.type === "REQUIRES_2FA") {
              cookie.pending_2fa.set({
                value: String(error.userId),
                httpOnly: true,
                secure: isProduction,
                sameSite: "lax",
                path: "/",
                maxAge: 5 * 60,
              });
              return {
                message: "2FA required",
                requires2fa: true,
              };
            }

            const problem = mapLoginError(error, instance);
            if (problem) {
              set.status = problem.status;
              set.headers["Content-Type"] = "application/problem+json";
              return problem;
            }
            // Should never reach here due to exhaustive switch
            return { message: "Unknown error" };
          }
        );
      },
      {
        body: AuthModel.login,
      }
    )
  )
  .group("", (app) =>
    app.use(rateLimit({ max: 5, window: 15 * 60 * 1000 })).post(
      "/2fa/login",
      async ({ body, cookie, request, set }) => {
        const instance = new URL(request.url).pathname;
        const pendingUserId = cookie.pending_2fa?.value;

        if (!pendingUserId) {
          set.status = HttpStatus.BAD_REQUEST;
          set.headers["Content-Type"] = "application/problem+json";
          return badRequest("No pending 2FA session", { instance });
        }

        const userId = Number.parseInt(String(pendingUserId), 10);
        if (Number.isNaN(userId)) {
          cookie.pending_2fa.remove();
          set.status = HttpStatus.BAD_REQUEST;
          set.headers["Content-Type"] = "application/problem+json";
          return badRequest("Invalid 2FA session", { instance });
        }

        const result = await AuthService.loginWith2fa(userId, body.code);

        cookie.pending_2fa.remove();

        return result.match(
          ({ sessionId, user }) => {
            cookie.session.set({
              value: sessionId,
              ...SESSION_COOKIE_OPTIONS,
            });
            return {
              message: "Login successful",
              user,
            };
          },
          (error) => {
            const problem = mapTotpError(error, instance);
            set.status = problem.status;
            set.headers["Content-Type"] = "application/problem+json";
            return problem;
          }
        );
      },
      {
        body: AuthModel.totpCode,
      }
    )
  )
  .post(
    "/verify-email",
    async ({ body, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await AuthService.verifyEmail(body.token);

      return result.match(
        () => ({ message: "Email verified successfully" }),
        (error) => {
          const problem = mapTokenError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: AuthModel.verifyEmail,
    }
  )
  .group("", (app) =>
    app.use(rateLimit({ max: 3, window: 60 * 60 * 1000 })).post(
      "/forgot-password",
      async ({ body }) => {
        const result = await AuthService.requestPasswordReset(body.email);

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
  .group("", (app) =>
    app.use(rateLimit({ max: 5, window: 60 * 60 * 1000 })).post(
      "/reset-password",
      async ({ body, request, set }) => {
        const instance = new URL(request.url).pathname;
        const result = await AuthService.resetPassword(
          body.token,
          body.password
        );

        return result.match(
          () => ({ message: "Password reset successfully" }),
          (error) => {
            // Handle token errors and password errors
            if (
              error.type === "INVALID_TOKEN" ||
              error.type === "EXPIRED_TOKEN"
            ) {
              const problem = mapTokenError(error, instance);
              set.status = problem.status;
              set.headers["Content-Type"] = "application/problem+json";
              return problem;
            }
            const problem = mapPasswordError(
              error as { type: "WEAK_PASSWORD"; requirements: string[] },
              instance
            );
            set.status = problem.status;
            set.headers["Content-Type"] = "application/problem+json";
            return problem;
          }
        );
      },
      {
        body: AuthModel.resetPassword,
      }
    )
  )
  .group("", (app) =>
    app
      .use(rateLimit({ max: 10, window: 60 * 1000 }))
      .get("/42", ({ cookie, request, set }) => {
        const instance = new URL(request.url).pathname;
        const result = AuthService.generateOAuthUrl();

        if (!result) {
          set.status = HttpStatus.SERVICE_UNAVAILABLE;
          set.headers["Content-Type"] = "application/problem+json";
          return serviceUnavailable("OAuth is not configured", { instance });
        }

        const { url, state } = result;

        cookie.oauth_state.set({
          value: state,
          ...OAUTH_STATE_COOKIE_OPTIONS,
        });

        set.status = HttpStatus.FOUND;
        set.headers["Location"] = url;
      })
  )
  .group("", (app) =>
    app.use(rateLimit({ max: 10, window: 60 * 1000 })).get(
      "/42/callback",
      async ({ query, cookie, set }) => {
        const code = query.code;
        const state = query.state;
        const storedState = cookie.oauth_state?.value;

        cookie.oauth_state.remove();

        if (!code || !state || !storedState) {
          set.status = HttpStatus.FOUND;
          set.headers["Location"] =
            `${env.FRONTEND_URL}/auth/login?error=invalid_oauth`;
          return;
        }

        const result = await AuthService.handleOAuthCallback(
          code,
          String(storedState),
          state
        );

        return result.match(
          ({ sessionId, isNewUser }) => {
            cookie.session.set({
              value: sessionId,
              ...SESSION_COOKIE_OPTIONS,
            });

            const redirectUrl = isNewUser
              ? `${env.FRONTEND_URL}/welcome`
              : `${env.FRONTEND_URL}/`;
            set.status = HttpStatus.FOUND;
            set.headers["Location"] = redirectUrl;
          },
          (error) => {
            set.status = HttpStatus.FOUND;
            set.headers["Location"] =
              `${env.FRONTEND_URL}/auth/login?error=${error.type.toLowerCase()}`;
          }
        );
      },
      {
        query: AuthModel.oauthCallback,
      }
    )
  )
  .use(authGuard)
  .get("/me", ({ user }) => {
    return { user };
  })
  .post("/logout", async ({ cookie }) => {
    const sessionId = cookie.session?.value;
    if (sessionId) {
      await AuthService.logout(String(sessionId));
    }
    cookie.session.remove();
    return { message: "Logged out successfully" };
  })
  .post("/logout-all", async ({ user, cookie }) => {
    await AuthService.logoutAllDevices(user.id);
    cookie.session.remove();
    return { message: "Logged out from all devices" };
  })
  .post("/resend-verification", async ({ user }) => {
    const result = await AuthService.resendVerificationEmail(user.id);

    return {
      message: "Verification email sent",
      verificationToken:
        !isProduction && result.isOk()
          ? result.value.verificationToken
          : undefined,
    };
  })
  .post(
    "/change-password",
    async ({ body, user, cookie, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await AuthService.changePassword(
        user.id,
        body.currentPassword,
        body.newPassword
      );

      return result.match(
        () => {
          cookie.session.remove();
          return {
            message: "Password changed successfully. Please log in again.",
          };
        },
        (error) => {
          const problem = mapPasswordError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: AuthModel.changePassword,
    }
  )
  .get("/42/link", ({ cookie, request, set }) => {
    const instance = new URL(request.url).pathname;
    const result = AuthService.generateOAuthUrl();

    if (!result) {
      set.status = HttpStatus.SERVICE_UNAVAILABLE;
      set.headers["Content-Type"] = "application/problem+json";
      return serviceUnavailable("OAuth is not configured", { instance });
    }

    const { url, state } = result;

    cookie.oauth_state.set({
      value: `link:${state}`,
      ...OAUTH_STATE_COOKIE_OPTIONS,
    });

    set.status = HttpStatus.FOUND;
    set.headers["Location"] = url;
  })

  .get(
    "/42/link/callback",
    async ({ query, cookie, user, set }) => {
      const code = query.code;
      const state = query.state;
      const storedState = cookie.oauth_state?.value;

      cookie.oauth_state.remove();

      if (!code || !state || !storedState) {
        set.status = HttpStatus.FOUND;
        set.headers["Location"] =
          `${env.FRONTEND_URL}/settings/security?error=invalid_oauth`;
        return;
      }

      const actualStoredState = String(storedState).replace("link:", "");

      const result = await AuthService.linkOAuthAccount(
        user.id,
        code,
        actualStoredState,
        state
      );

      return result.match(
        () => {
          set.status = HttpStatus.FOUND;
          set.headers["Location"] =
            `${env.FRONTEND_URL}/settings/security?success=42_linked`;
        },
        (error) => {
          set.status = HttpStatus.FOUND;
          set.headers["Location"] =
            `${env.FRONTEND_URL}/settings/security?error=${error.type.toLowerCase()}`;
        }
      );
    },
    {
      query: AuthModel.oauthCallback,
    }
  )
  .post(
    "/42/unlink",
    async ({ body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await AuthService.unlinkOAuthAccount(
        user.id,
        body.password
      );

      return result.match(
        () => ({ message: "42 account unlinked successfully" }),
        (error) => {
          const problem = mapOAuthUnlinkError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: AuthModel.unlinkOAuth,
    }
  )
  .post("/2fa/enable", async ({ user, request, set }) => {
    const instance = new URL(request.url).pathname;
    const result = await AuthService.enableTotp(user.id);

    return result.match(
      ({ qrCodeUrl, secret }) => ({
        message: "Scan the QR code with your authenticator app",
        qrCodeUrl,
        secret,
      }),
      (error) => {
        const problem = mapTotpError(error, instance);
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }
    );
  })
  .post(
    "/2fa/verify",
    async ({ body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await AuthService.confirmTotp(user.id, body.code);

      return result.match(
        () => ({ message: "2FA enabled successfully" }),
        (error) => {
          const problem = mapTotpError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: AuthModel.totpCode,
    }
  )
  .post(
    "/2fa/disable",
    async ({ body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await AuthService.disableTotp(user.id, body.code);

      return result.match(
        () => ({ message: "2FA disabled successfully" }),
        (error) => {
          const problem = mapTotpError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: AuthModel.totpCode,
    }
  );
