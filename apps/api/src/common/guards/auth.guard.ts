import { Elysia } from "elysia";

import { authService, type SafeUser } from "../../modules/auth/auth.service";

// Custom error class for auth errors
class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Authentication guard plugin for Elysia.
 *
 * This plugin:
 * - Reads the session ID from the HttpOnly cookie
 * - Validates the session via authService.validateSession()
 * - Attaches the user to the context if valid
 * - Returns 401 if session is missing or expired
 */
export const authGuard = new Elysia({ name: "auth-guard" })
  .error({ AUTH_ERROR: AuthError })
  .onError(({ code, error, set }) => {
    if (code === "AUTH_ERROR") {
      set.status = error.statusCode;
      return { message: error.message };
    }
  })
  .derive({ as: "scoped" }, async (ctx): Promise<{ user: SafeUser }> => {
    const sessionCookie = ctx.cookie.session;
    const sessionId = sessionCookie?.value;

    if (!sessionId) {
      throw new AuthError("Authentication required", 401);
    }

    const result = await authService.validateSession(String(sessionId));

    if (result.isErr()) {
      // Clear invalid session cookie
      ctx.cookie.session.remove();

      const err = result.error;
      if (err.type === "EXPIRED") {
        throw new AuthError("Session expired", 401);
      }
      throw new AuthError("Invalid session", 401);
    }

    // Add user to context
    return { user: result.value };
  });
