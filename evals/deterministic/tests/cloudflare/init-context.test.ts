import { expect, test } from "@playwright/test";
import type { Page } from "@browserbasehq/stagehand";
import { z } from "zod/v3";
import {
  type CloudflareFixtureServer,
  createCloudflareStagehand,
  instrumentContextNewCDPSession,
  ScriptedLLMClient,
  startCloudflareFixtureServer,
} from "./cloudflareTestUtils";

test.describe("Cloudflare init and context", () => {
  let server: CloudflareFixtureServer;

  test.beforeAll(async () => {
    server = await startCloudflareFixtureServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test("initializes without CDP-only setup", async ({ page }) => {
    const { context, getCount, restore } = instrumentContextNewCDPSession(
      page.context(),
    );
    const llmClient = new ScriptedLLMClient();
    const stagehand = createCloudflareStagehand(page, llmClient, context);

    try {
      await stagehand.init();

      expect(stagehand.env).toBe("CLOUDFLARE");
      expect(getCount()).toBe(0);

      await stagehand.close();
    } finally {
      restore();
    }
  });

  test("context.newPage and popup tracking do not attach CDP frame listeners", async ({
    page,
  }) => {
    const { context, getCount, restore } = instrumentContextNewCDPSession(
      page.context(),
    );
    const llmClient = new ScriptedLLMClient("openai/gpt-4.1-mini", [
      () => ({
        data: { pageText: "Popup Target" },
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
      () => {
        return {
          data: { completed: true, progress: "done" },
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      },
    ]);
    const stagehand = createCloudflareStagehand(page, llmClient, context);

    try {
      await stagehand.init();
      const newPage = await stagehand.context.newPage();
      await newPage.goto(`${server.baseURL}/cloudflare`);

      await stagehand.page.goto(`${server.baseURL}/cloudflare`);
      const popupPromise = new Promise<Page>((resolve) => {
        stagehand.page.on("popup", resolve);
      });
      await stagehand.page.locator("#open-popup").click();
      const popup = await popupPromise;

      expect(typeof newPage.observe).toBe("function");
      expect(typeof popup.extract).toBe("function");
      expect(getCount()).toBe(0);

      await popup.extract({
        instruction: "Extract popup text.",
        schema: z.object({ pageText: z.string() }),
      });

      expect(getCount()).toBe(0);
      await stagehand.close();
    } finally {
      restore();
    }
  });
});
