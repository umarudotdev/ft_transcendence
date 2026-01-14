import { env } from "$lib/env";
import { paraglideMiddleware } from "$lib/paraglide/server";
import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

const PROTECTED_ROUTES = ["/profile", "/settings"];

/**
 * Check if a path requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Check if path is an API route (should be proxied, not handled by SvelteKit)
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api");
}

/**
 * Authentication handler - redirects unauthenticated users to login
 */
const handleAuth: Handle = async ({ event, resolve }) => {
  if (isApiRoute(event.url.pathname)) {
    return resolve(event);
  }

  if (!isProtectedRoute(event.url.pathname)) {
    return resolve(event);
  }

  const sessionCookie = event.cookies.get("session");

  if (!sessionCookie) {
    throw redirect(302, "/auth/login");
  }

  try {
    const response = await fetch(`${env.API_URL}/api/auth/me`, {
      headers: {
        cookie: `session=${sessionCookie}`,
      },
    });

    if (!response.ok) {
      throw redirect(302, "/auth/login");
    }

    const data = await response.json();
    event.locals.user = data.user;
  } catch (error) {
    if (
      error instanceof Response ||
      (error as { status?: number }).status === 302
    ) {
      throw error;
    }

    throw redirect(302, "/auth/login");
  }

  return resolve(event);
};

/**
 * Paraglide i18n handler
 */
const handleParaglide: Handle = ({ event, resolve }) => {
  if (isApiRoute(event.url.pathname)) {
    return resolve(event);
  }

  return paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace("%paraglide.lang%", locale),
    });
  });
};

export const handle: Handle = sequence(handleAuth, handleParaglide);
