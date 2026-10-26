import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      STORAGE_MODE: "local",
      LOCAL_DATA_DIR: "/tmp/tabelog-e2e",
      DIARY_PASSWORD: "tabelog-test-password",
      SESSION_SECRET: "test-only-secret-at-least-32-characters-long",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
