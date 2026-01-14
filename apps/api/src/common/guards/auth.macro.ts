import { Elysia } from "elysia";

import type { SafeUser } from "../../modules/auth/auth.model";
import type { ProblemDetails } from "../errors/problem-details";

import { AuthService } from "../../modules/auth/auth.service";
import { HttpStatus } from "../errors/error-types";
import { unauthorized } from "../errors/problem-details-helper";

const PROBLEM_JSON_CONTENT_TYPE = "application/problem+json";

class AuthError extends Error {
  public readonly problem: ProblemDetails;

  constructor(detail: string, instance?: string) {
    super(detail);
    this.name = "AuthError";
    this.problem = unauthorized(detail, { instance });
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
  .onError(({ code, error, set, request }) => {
    if (code === "AUTH_ERROR") {
      set.status = HttpStatus.UNAUTHORIZED;
      set.headers["Content-Type"] = PROBLEM_JSON_CONTENT_TYPE;
      return {
        ...error.problem,
        instance: error.problem.instance ?? new URL(request.url).pathname,
      };
    }
  })
  .macro({
    isSignedIn: {
      async resolve({ cookie, request }): Promise<{ user: SafeUser }> {
        const instance = new URL(request.url).pathname;
        const sessionCookie = cookie.session;
        const sessionId = sessionCookie?.value;

        if (!sessionId) {
          throw new AuthError("Authentication required", instance);
        }

        const result = await AuthService.validateSession(String(sessionId));

        if (result.isErr()) {
          cookie.session.remove();

          const err = result.error;
          if (err.type === "EXPIRED") {
            throw new AuthError("Session expired", instance);
          }
          throw new AuthError("Invalid session", instance);
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
  .onError(({ code, error, set, request }) => {
    if (code === "AUTH_ERROR") {
      set.status = HttpStatus.UNAUTHORIZED;
      set.headers["Content-Type"] = PROBLEM_JSON_CONTENT_TYPE;
      return {
        ...error.problem,
        instance: error.problem.instance ?? new URL(request.url).pathname,
      };
    }
  })
  .derive({ as: "scoped" }, async (ctx): Promise<{ user: SafeUser }> => {
    const instance = new URL(ctx.request.url).pathname;
    const sessionCookie = ctx.cookie.session;
    const sessionId = sessionCookie?.value;

    if (!sessionId) {
      throw new AuthError("Authentication required", instance);
    }

    const result = await AuthService.validateSession(String(sessionId));

    if (result.isErr()) {
      ctx.cookie.session.remove();

      const err = result.error;
      if (err.type === "EXPIRED") {
        throw new AuthError("Session expired", instance);
      }
      throw new AuthError("Invalid session", instance);
    }

    return { user: result.value };
  });

export type { SafeUser };
