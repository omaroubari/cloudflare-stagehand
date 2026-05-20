import { expect, test } from "@playwright/test";
import {
  type CloudflareFixtureServer,
  createCloudflareStagehand,
  findElementId,
  ScriptedLLMClient,
  startCloudflareFixtureServer,
  zeroUsage,
} from "./cloudflareTestUtils";

test.describe("Cloudflare iframe fallback", () => {
  let server: CloudflareFixtureServer;

  test.beforeAll(async () => {
    server = await startCloudflareFixtureServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test("observe sees same-origin iframe content and returns a usable observation", async ({
    page,
  }) => {
    const llmClient = new ScriptedLLMClient("openai/gpt-4.1-mini", [
      (call) => {
        expect(call.prompt).toContain("Frame CTA");
        return {
          data: {
            elements: [
              {
                elementId: findElementId(call.prompt, "Frame CTA"),
                description: "Frame CTA link",
                method: "click",
                arguments: [],
              },
            ],
          },
          usage: zeroUsage(),
        };
      },
    ]);
    const stagehand = createCloudflareStagehand(page, llmClient);

    await stagehand.init();
    await stagehand.page.goto(`${server.baseURL}/iframe`);

    const [observation] = await stagehand.page.observe({
      instruction: "Find the Frame CTA inside the iframe.",
      iframes: true,
    });

    expect(observation).toMatchObject({
      description: "Frame CTA link",
      method: "click",
      selector: expect.stringContaining("iframe[1]"),
      href: `${server.baseURL}/iframe-target`,
    });

    const actResult = await stagehand.page.act(observation);

    expect(actResult).toMatchObject({
      success: true,
      action: "Frame CTA link",
    });
    await expect(stagehand.page.locator("h1")).toHaveText("Iframe Target");
    expect(stagehand.page.url()).toBe(`${server.baseURL}/iframe-target`);

    await stagehand.close();
  });

  test("act can click through a same-origin iframe", async ({ page }) => {
    const llmClient = new ScriptedLLMClient("openai/gpt-4.1-mini", [
      (call) => {
        expect(call.prompt).toContain("Frame Button");
        return {
          data: {
            elements: [
              {
                elementId: findElementId(call.prompt, "Frame Button"),
                description: "Frame Button",
                method: "click",
                arguments: [],
              },
            ],
          },
          usage: zeroUsage(),
        };
      },
    ]);
    const stagehand = createCloudflareStagehand(page, llmClient);

    await stagehand.init();
    await stagehand.page.goto(`${server.baseURL}/iframe`);

    const result = await stagehand.page.act({
      action: "click the Frame Button",
      iframes: true,
    });

    expect(result).toMatchObject({
      success: true,
      action: "Frame Button",
    });
    await expect(
      stagehand.page
        .frameLocator('iframe[name="catalog-frame"]')
        .locator("#frame-status"),
    ).toHaveText("Frame button clicked");

    await stagehand.close();
  });
});
