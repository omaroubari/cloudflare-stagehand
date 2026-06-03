import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/cloudflare",

  timeout: 60000,

  forbidOnly: !!process.env.CI,

  fullyParallel: true,

  reporter: "line",

  retries: process.env.CI ? 2 : 0,

  use: {
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
