import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `npm run build && PORT=${port} npm run start`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    timeout: 120000,
  },
});
