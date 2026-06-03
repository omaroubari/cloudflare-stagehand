import { expect, test } from "@playwright/test";
import { CloudflareBrowserProvider } from "cloudflare-stagehand";
import { chromium } from "playwright";

const noopLogger = () => {};

test.describe("CloudflareBrowserProvider", () => {
  let server: Awaited<ReturnType<typeof chromium.launchServer>>;

  test.beforeAll(async () => {
    server = await chromium.launchServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test("connects to the CDP URL and returns the Cloudflare environment", async () => {
    const cdpUrl = server.wsEndpoint();
    const provider = new CloudflareBrowserProvider(
      noopLogger,
      { cdpUrl },
      "test-api-key",
    );

    const result = await provider.getBrowser();

    expect(result.env).toBe("CLOUDFLARE");
    expect(result.context).toBeDefined();
    expect(result.browser).toBeDefined();

    await provider.close();
  });

  test("reuses the first existing browser context", async () => {
    const cdpUrl = server.wsEndpoint();
    const browser = await chromium.connectOverCDP(cdpUrl);
    const existingContext = await browser.newContext();

    const provider = new CloudflareBrowserProvider(
      noopLogger,
      { cdpUrl },
      "test-api-key",
    );

    const result = await provider.getBrowser();
    expect(result.context).toBe(existingContext);

    await provider.close();
  });

  test("throws when CLOUDFLARE_API_TOKEN is missing", async () => {
    const provider = new CloudflareBrowserProvider(
      noopLogger,
      { cdpUrl: "ws://127.0.0.1:9222" },
      undefined,
    );

    await expect(provider.getBrowser()).rejects.toThrow("CLOUDFLARE_API_TOKEN");
  });

  test("throws when cdpUrl is missing", async () => {
    const provider = new CloudflareBrowserProvider(
      noopLogger,
      { cdpUrl: "" },
      "test-api-key",
    );

    await expect(provider.getBrowser()).rejects.toThrow("cdpUrl");
  });

  test("close() is a no-op if the browser was never connected", async () => {
    const provider = new CloudflareBrowserProvider(
      noopLogger,
      { cdpUrl: "ws://127.0.0.1:9222" },
      "test-api-key",
    );

    await expect(provider.close()).resolves.toBeUndefined();
  });

  test("ignores target-closed errors during close", async () => {
    const cdpUrl = server.wsEndpoint();
    const provider = new CloudflareBrowserProvider(
      noopLogger,
      { cdpUrl },
      "test-api-key",
    );

    const result = await provider.getBrowser();
    // Force the remote browser to detach the target so the provider's
    // subsequent close() encounters a target-closed error.
    await result.browser?.close();

    await expect(provider.close()).resolves.toBeUndefined();
  });
});
