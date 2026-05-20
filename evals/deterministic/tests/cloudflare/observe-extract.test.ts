import { expect, test } from "@playwright/test";
import { z } from "zod/v3";
import {
  type CloudflareFixtureServer,
  createCloudflareStagehand,
  findElementId,
  ScriptedLLMClient,
  startCloudflareFixtureServer,
  zeroUsage,
} from "./cloudflareTestUtils";

test.describe("Cloudflare observe and extract", () => {
  let server: CloudflareFixtureServer;

  test.beforeAll(async () => {
    server = await startCloudflareFixtureServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test("observe uses the Playwright accessibility fallback against fixture HTML", async ({
    page,
  }) => {
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
            {
              elementId: findElementId(call.prompt, "Search"),
              description: "Search input",
              method: "fill",
              arguments: ["stagehand"],
            },
          ],
        },
        usage: zeroUsage(),
      }),
    ]);
    const stagehand = createCloudflareStagehand(page, llmClient);

    await stagehand.init();
    await stagehand.page.goto(`${server.baseURL}/cloudflare`);

    const results = await stagehand.page.observe({
      instruction: "Find shopping controls.",
    });

    expect(llmClient.calls[0]?.prompt).toContain("Shop All");
    expect(llmClient.calls[0]?.prompt).toContain("Search");
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "Shop All link",
          selector: expect.stringContaining("xpath=/"),
          href: `${server.baseURL}/target`,
        }),
        expect.objectContaining({
          description: "Search input",
          selector: expect.stringContaining("xpath=/"),
        }),
      ]),
    );

    await stagehand.close();
  });

  test("extract uses the Playwright accessibility fallback against fixture HTML", async ({
    page,
  }) => {
    const llmClient = new ScriptedLLMClient("openai/gpt-4.1-mini", [
      (call) => {
        expect(call.responseModelName).toBe("Extraction");
        expect(call.prompt).toContain("Cloudflare Fixture");
        expect(call.prompt).toContain("Sort");
        return {
          data: {
            title: "Cloudflare Fixture",
            primaryLink: "Shop All",
          },
          usage: zeroUsage(),
        };
      },
      (call) => {
        expect(call.responseModelName).toBe("Metadata");
        return {
          data: { completed: true, progress: "fixture extracted" },
          usage: zeroUsage(),
        };
      },
    ]);
    const stagehand = createCloudflareStagehand(page, llmClient);

    await stagehand.init();
    await stagehand.page.goto(`${server.baseURL}/cloudflare`);

    const result = await stagehand.page.extract({
      instruction: "Extract the title and primary link text.",
      schema: z.object({
        title: z.string(),
        primaryLink: z.string(),
      }),
    });

    expect(result).toMatchObject({
      title: "Cloudflare Fixture",
      primaryLink: "Shop All",
    });
    expect(llmClient.calls).toHaveLength(2);

    await stagehand.close();
  });
});
