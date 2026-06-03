import { expect, test } from "@playwright/test";
import { CloudflareBrowserProvider } from "cloudflare-stagehand";
import { chromium, type Browser } from "playwright";
import net from "node:net";

const noopLogger = () => {};

async function findFreePort(): Promise<number> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

async function waitForCdp(port: number, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl: string };
        return data.webSocketDebuggerUrl;
      }
      lastError = new Error(`Unexpected status ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `CDP server did not become ready on port ${port}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

test.describe("CloudflareBrowserProvider", () => {
  let browser: Browser;
  let cdpUrl: string;

  test.beforeAll(async () => {
    const port = await findFreePort();
    browser = await chromium.launch({
      headless: true,
      args: [`--remote-debugging-port=${port}`],
    });
    cdpUrl = await waitForCdp(port);
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test("connects to the CDP URL and returns the Cloudflare environment", async () => {
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
    const remoteBrowser = await chromium.connectOverCDP(cdpUrl);
    const existingContext = await remoteBrowser.newContext();
    const existingPage = await existingContext.newPage();
    await existingPage.goto("data:text/html,<title>existing</title>");

    const provider = new CloudflareBrowserProvider(
      noopLogger,
      { cdpUrl },
      "test-api-key",
    );

    const result = await provider.getBrowser();
    // Different `Browser` clients wrap the same underlying browser context in
    // distinct proxy objects, so identity can't be checked with `toBe`. The
    // shared page and its title confirm the provider reused the existing
    // context rather than creating a new one.
    expect(result.context).not.toBe(existingContext);
    expect(result.context.pages().length).toBe(1);
    expect(await result.context.pages()[0].title()).toBe("existing");

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
