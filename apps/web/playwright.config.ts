import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://localhost:4173",
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:4173",
  },
});
