import type { App } from "@api/index";

import { treaty } from "@elysiajs/eden";

const getBaseUrl = () => {
  if (import.meta.env.DEV) {
    return "http://localhost:3000";
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return import.meta.env.API_URL ?? "http://localhost:3000";
};

export const api = treaty<App>(getBaseUrl(), {
  fetch: { credentials: "include" },
});
