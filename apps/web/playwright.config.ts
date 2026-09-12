import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:4173", headless: true, launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined }, viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true },
  webServer: { command: "pnpm exec vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: !process.env.CI, timeout: 30_000 },
  reporter: [["list"]],
});
