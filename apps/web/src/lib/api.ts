import type { App } from "@api/index";

import { treaty } from "@elysiajs/eden";

const getBaseUrl = () => {
  // In development, call the API directly to avoid proxy issues
  if (import.meta.env.DEV) {
    return "http://localhost:3000";
  }

  // In production, use the same origin (reverse proxy handles routing)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side fallback
  return import.meta.env.API_URL ?? "http://localhost:3000";
};

export const api = treaty<App>(getBaseUrl());
