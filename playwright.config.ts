import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 20_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4174",
  },
  webServer: {
    // Serve the already-built dist/ folder. Run `npm run build` first if needed.
    command: "npx vite preview --port 4174",
    port: 4174,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
