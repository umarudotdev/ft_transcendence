import type { App } from "@api/index";

import { treaty } from "@elysiajs/eden";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.API_URL ?? "http://localhost:3000";
};

export const api = treaty<App>(getBaseUrl());
