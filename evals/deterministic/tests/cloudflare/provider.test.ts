import { expect, test } from "@playwright/test";
import {
  CloudflareBrowserProvider,
  type BrowserResult,
} from "@browserbasehq/stagehand";

test.describe("CloudflareBrowserProvider", () => {
  test("launches with keep_alive and returns the Cloudflare environment", async () => {
    const launchCalls: unknown[][] = [];
    const browser = {
      newContext: async () => ({ close: async () => {} }),
      close: async () => {},
    };
    const launch = async (...args: unknown[]) => {
      launchCalls.push(args);
      return browser;
    };

    const Provider = CloudflareBrowserProvider as unknown as new (
      binding: unknown,
      launchBrowser: (binding: unknown, options?: unknown) => Promise<unknown>,
    ) => {
      getBrowser(): Promise<BrowserResult>;
      close(): Promise<void>;
    };

    const provider = new Provider("binding", launch);
    const result = await provider.getBrowser();

    expect(result.env).toBe("CLOUDFLARE");
    expect(launchCalls).toEqual([["binding", { keep_alive: 600_000 }]]);
  });

  test("wraps Cloudflare websocket handshake failures with guidance", async () => {
    const Provider = CloudflareBrowserProvider as unknown as new (
      binding: unknown,
      launchBrowser: (binding: unknown, options?: unknown) => Promise<unknown>,
    ) => {
      getBrowser(): Promise<BrowserResult>;
      close(): Promise<void>;
    };

    const provider = new Provider("binding", async () => {
      throw new TypeError("Cannot read properties of null (reading 'accept')");
    });

    await expect(provider.getBrowser()).rejects.toThrow(
      "no_websocket_standard_binary_type",
    );
  });

  test("ignores target-closed errors during close", async () => {
    const Provider = CloudflareBrowserProvider as unknown as new (
      binding: unknown,
      launchBrowser: (binding: unknown, options?: unknown) => Promise<unknown>,
    ) => {
      getBrowser(): Promise<BrowserResult>;
      close(): Promise<void>;
    };

    const provider = new Provider("binding", async () => ({
      newContext: async () => ({ close: async () => {} }),
      close: async () => {
        throw new Error("Target page, context or browser has been closed");
      },
    }));

    await provider.getBrowser();
    await expect(provider.close()).resolves.toBeUndefined();
  });

  test("rethrows unexpected close errors", async () => {
    const Provider = CloudflareBrowserProvider as unknown as new (
      binding: unknown,
      launchBrowser: (binding: unknown, options?: unknown) => Promise<unknown>,
    ) => {
      getBrowser(): Promise<BrowserResult>;
      close(): Promise<void>;
    };

    const provider = new Provider("binding", async () => ({
      newContext: async () => ({ close: async () => {} }),
      close: async () => {
        throw new Error("unexpected close failure");
      },
    }));

    await provider.getBrowser();
    await expect(provider.close()).rejects.toThrow("unexpected close failure");
  });
});
