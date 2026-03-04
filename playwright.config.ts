import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3002",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
  },
  // Starts the dev server automatically before tests run
  webServer: {
    command: "npm run dev -- --port 3002",
    url: "http://localhost:3002",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
