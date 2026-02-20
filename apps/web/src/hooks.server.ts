import { env } from "$lib/env";
import { paraglideMiddleware } from "$lib/paraglide/server";
import { logger } from "$lib/server/logger";
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
  return pathname.startsWith("/api") || pathname.startsWith("/uploads");
}

/**
 * API proxy handler - forwards /api/* requests to the API server
 */
const handleApiProxy: Handle = async ({ event, resolve }) => {
  if (!isApiRoute(event.url.pathname)) {
    return resolve(event);
  }

  const apiUrl = `${env.API_URL}${event.url.pathname}${event.url.search}`;

  // Headers to exclude from request forwarding
  const excludedRequestHeaders = new Set([
    "host",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "accept-encoding", // Let fetch handle compression
  ]);

  // Headers to exclude from response forwarding
  const excludedResponseHeaders = new Set([
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "content-encoding", // fetch auto-decompresses, so don't forward this
    "content-length", // Length changes after decompression
  ]);

  const headers = new Headers();
  for (const [key, value] of event.request.headers.entries()) {
    if (!excludedRequestHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  try {
    const response = await fetch(apiUrl, {
      method: event.request.method,
      headers,
      body:
        event.request.method !== "GET" && event.request.method !== "HEAD"
          ? await event.request.arrayBuffer()
          : undefined,
      redirect: "manual", // Don't follow redirects, pass them to client
    });

    const responseHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
      if (
        key.toLowerCase() === "set-cookie" ||
        excludedResponseHeaders.has(key.toLowerCase())
      ) {
        continue;
      }
      responseHeaders.set(key, value);
    }
    for (const cookie of response.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", cookie);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    logger
      .withMetadata({ path: event.url.pathname })
      .withError(error instanceof Error ? error : new Error(String(error)))
      .error("API proxy error");
    return new Response(JSON.stringify({ error: "Proxy error" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
};

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

export const handle: Handle = sequence(
  handleApiProxy,
  handleAuth,
  handleParaglide
);
