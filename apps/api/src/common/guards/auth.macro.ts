import { Elysia } from "elysia";

import type { SafeUser } from "../../modules/auth/auth.model";

import { AuthService } from "../../modules/auth/auth.service";

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
 * Authentication macro for Elysia routes.
 *
 * Usage in controllers:
 * ```typescript
 * .use(AuthMacro)
 * .get("/protected", ({ user }) => { ... }, { isSignedIn: true })
 * ```
 */
export const AuthMacro = new Elysia({ name: "Auth.Macro" })
  .error({ AUTH_ERROR: AuthError })
  .onError(({ code, error, set }) => {
    if (code === "AUTH_ERROR") {
      set.status = error.statusCode;
      return { message: error.message };
    }
  })
  .macro({
    isSignedIn: {
      async resolve({ cookie }): Promise<{ user: SafeUser }> {
        const sessionCookie = cookie.session;
        const sessionId = sessionCookie?.value;

        if (!sessionId) {
          throw new AuthError("Authentication required", 401);
        }

        const result = await AuthService.validateSession(String(sessionId));

        if (result.isErr()) {
          cookie.session.remove();

          const err = result.error;
          if (err.type === "EXPIRED") {
            throw new AuthError("Session expired", 401);
          }
          throw new AuthError("Invalid session", 401);
        }

        return { user: result.value };
      },
    },
  });

/**
 * Legacy authentication guard using derive pattern.
 * Use AuthMacro with `{ isSignedIn: true }` for new routes.
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

    const result = await AuthService.validateSession(String(sessionId));

    if (result.isErr()) {
      ctx.cookie.session.remove();

      const err = result.error;
      if (err.type === "EXPIRED") {
        throw new AuthError("Session expired", 401);
      }
      throw new AuthError("Invalid session", 401);
    }

    return { user: result.value };
  });

export type { SafeUser };
