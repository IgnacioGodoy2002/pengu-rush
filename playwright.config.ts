import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 20_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4174",
  },
  webServer: {
    // Dev server (import.meta.env.DEV=true) so test hooks are active.
    // Production builds strip the hooks via dead-code elimination.
    command: "npx vite --port 4174",
    port: 4174,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
