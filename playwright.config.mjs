import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30000,
  use: { browserName: "chromium", viewport: { width: 1200, height: 900 } }
});
