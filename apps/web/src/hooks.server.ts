import { env } from "$lib/env";
import { paraglideMiddleware } from "$lib/paraglide/server";
import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

// Routes that require authentication
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
  // Skip API routes - let Vite proxy handle them
  if (isApiRoute(event.url.pathname)) {
    return resolve(event);
  }

  // Only check protected routes
  if (!isProtectedRoute(event.url.pathname)) {
    return resolve(event);
  }

  // Get session cookie from the request
  const sessionCookie = event.cookies.get("session");

  if (!sessionCookie) {
    // No session cookie - redirect to login
    throw redirect(302, "/auth/login");
  }

  // Validate session by calling the API
  try {
    const response = await fetch(`${env.API_URL}/api/auth/me`, {
      headers: {
        cookie: `session=${sessionCookie}`,
      },
    });

    if (!response.ok) {
      // Session invalid or expired - redirect to login
      throw redirect(302, "/auth/login");
    }

    // Session is valid - attach user to locals for use in pages
    const data = await response.json();
    event.locals.user = data.user;
  } catch (error) {
    // If it's already a redirect, rethrow it
    if (
      error instanceof Response ||
      (error as { status?: number }).status === 302
    ) {
      throw error;
    }

    // Network error or other issue - redirect to login
    throw redirect(302, "/auth/login");
  }

  return resolve(event);
};

/**
 * Paraglide i18n handler
 */
const handleParaglide: Handle = ({ event, resolve }) => {
  // Skip API routes - they don't need i18n
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
