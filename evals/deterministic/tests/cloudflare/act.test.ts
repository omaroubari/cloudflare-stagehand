import { expect, test } from "@playwright/test";
import {
  type CloudflareFixtureServer,
  createCloudflareStagehand,
  findElementId,
  ScriptedLLMClient,
  startCloudflareFixtureServer,
  zeroUsage,
} from "./cloudflareTestUtils";

test.describe("Cloudflare act", () => {
  let server: CloudflareFixtureServer;

  test.beforeAll(async () => {
    server = await startCloudflareFixtureServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test("link actions navigate through captured href", async ({ page }) => {
    const llmClient = new ScriptedLLMClient("openai/gpt-4.1-mini", [
      (call) => ({
        data: {
          elements: [
            {
              elementId: findElementId(call.prompt, "Shop All"),
              description: "Shop All link",
              method: "click",
              arguments: [],
            },
          ],
        },
        usage: zeroUsage(),
      }),
    ]);
    const stagehand = createCloudflareStagehand(page, llmClient);

    await stagehand.init();
    await stagehand.page.goto(`${server.baseURL}/cloudflare`);

    const result = await stagehand.page.act('click "Shop All"');

    expect(result).toMatchObject({
      success: true,
      action: "Shop All link",
    });
    expect(stagehand.page.url()).toBe(`${server.baseURL}/target`);
    await expect(stagehand.page.locator("h1")).toHaveText("Target Page");

    await stagehand.close();
  });

  test("non-link actions use Playwright input paths for click and fill", async ({
    page,
  }) => {
    const llmClient = new ScriptedLLMClient("openai/gpt-4.1-mini", [
      (call) => ({
        data: {
          elements: [
            {
              elementId: findElementId(call.prompt, "Search"),
              description: "Search input",
              method: "fill",
              arguments: ["serum"],
            },
          ],
        },
        usage: zeroUsage(),
      }),
      (call) => ({
        data: {
          elements: [
            {
              elementId: findElementId(call.prompt, "Primary CTA"),
              description: "Primary CTA button",
              method: "click",
              arguments: [],
            },
          ],
        },
        usage: zeroUsage(),
      }),
    ]);
    const stagehand = createCloudflareStagehand(page, llmClient);

    await stagehand.init();
    await stagehand.page.goto(`${server.baseURL}/cloudflare`);

    await expect(stagehand.page.locator("#search")).toHaveValue("");
    const fillResult = await stagehand.page.act("fill the search input");

    expect(fillResult).toMatchObject({
      success: true,
      action: "Search input",
    });
    await expect(stagehand.page.locator("#search")).toHaveValue("serum");

    const clickResult = await stagehand.page.act("click the primary CTA");

    expect(clickResult).toMatchObject({
      success: true,
      action: "Primary CTA button",
    });
    await expect(stagehand.page.locator("#status")).toHaveText(
      "Button clicked",
    );

    await stagehand.close();
  });
});
