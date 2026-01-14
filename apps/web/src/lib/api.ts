import type { App } from "@api/index";

import { treaty } from "@elysiajs/eden";

const getBaseUrl = () => {
  // Client-side: use the browser's origin (proxied by Vite in dev)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: use env module (dynamic require to avoid client-side bundle issues)
  const { env } = require("$lib/env") as typeof import("$lib/env");
  return env.API_URL;
};

export const api = treaty<App>(getBaseUrl());
