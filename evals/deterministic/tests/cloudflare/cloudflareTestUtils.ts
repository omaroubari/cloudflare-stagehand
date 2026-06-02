import {
  Stagehand,
  LLMClient,
  type CreateChatCompletionOptions,
} from "cloudflare-stagehand";
import express from "express";
import http from "http";
import type { BrowserContext, Page } from "playwright";
import type { ChatMessage } from "@/lib/llm/LLMClient";

export type CloudflareFixtureServer = {
  baseURL: string;
  close: () => Promise<void>;
};

type ScriptedResponder = (call: RecordedLLMCall) => Promise<unknown> | unknown;

export type RecordedLLMCall = {
  index: number;
  prompt: string;
  options: CreateChatCompletionOptions["options"];
  responseModelName?: string;
};

function htmlPage(title: string, body: string): string {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 24px;
        }
        main {
          max-width: 960px;
        }
        .spacer {
          height: 1200px;
        }
        .panel {
          display: grid;
          gap: 12px;
          max-width: 420px;
        }
        iframe {
          width: 100%;
          height: 180px;
          border: 1px solid #bbb;
        }
      </style>
    </head>
    <body>
      <main>${body}</main>
    </body>
  </html>`;
}

export async function startCloudflareFixtureServer(): Promise<CloudflareFixtureServer> {
  const app = express();

  app.get("/cloudflare", (_req, res) => {
    res.type("html").send(
      htmlPage(
        "Cloudflare Fixture",
        `
          <h1>Cloudflare Fixture</h1>
          <section class="panel">
            <a id="shop-all" href="/target">Shop All</a>
            <button
              id="open-popup"
              onclick="window.open('/target', 'cloudflare-popup')"
            >
              Open Target Popup
            </button>
            <label for="search">Search</label>
            <input id="search" name="search" placeholder="Search products" />
            <label for="sort">Sort</label>
            <select id="sort" name="sort">
              <option value="popular">Popular</option>
              <option value="new">New</option>
            </select>
            <button
              id="primary-action"
              onclick="document.getElementById('status').textContent = 'Button clicked';"
            >
              Primary CTA
            </button>
            <div id="status" aria-live="polite">Idle</div>
          </section>
          <div class="spacer"></div>
          <section class="panel">
            <button
              id="deep-action"
              onclick="document.getElementById('deep-status').textContent = 'Deep button clicked';"
            >
              Deep Button
            </button>
            <div id="deep-status" aria-live="polite">Waiting</div>
          </section>
        `,
      ),
    );
  });

  app.get("/target", (_req, res) => {
    res.type("html").send(
      htmlPage(
        "Target Page",
        `
          <h1>Target Page</h1>
          <p id="target-state">Target page reached.</p>
        `,
      ),
    );
  });

  app.get("/iframe", (_req, res) => {
    res.type("html").send(
      htmlPage(
        "Iframe Host",
        `
          <h1>Iframe Host</h1>
          <iframe name="catalog-frame" src="/frame-content"></iframe>
        `,
      ),
    );
  });

  app.get("/frame-content", (_req, res) => {
    res.type("html").send(
      htmlPage(
        "Frame Content",
        `
          <h2>Frame Content</h2>
          <a id="frame-cta" href="/iframe-target">Frame CTA</a>
          <button
            id="frame-button"
            onclick="document.getElementById('frame-status').textContent = 'Frame button clicked';"
          >
            Frame Button
          </button>
          <div id="frame-status" aria-live="polite">Frame idle</div>
        `,
      ),
    );
  });

  app.get("/iframe-target", (_req, res) => {
    res.type("html").send(
      htmlPage(
        "Iframe Target",
        `
          <h1>Iframe Target</h1>
          <p id="iframe-target-state">Reached the iframe target.</p>
        `,
      ),
    );
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Failed to start Cloudflare fixture server");
  }

  const baseURL = `http://127.0.0.1:${address.port}`;
  return {
    baseURL,
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

export function messagesToText(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const content = Array.isArray(message.content)
        ? message.content
            .map((item) => {
              if ("text" in item && typeof item.text === "string") {
                return item.text;
              }
              if ("image_url" in item && item.image_url?.url) {
                return item.image_url.url;
              }
              if ("source" in item && item.source?.data) {
                return item.source.data;
              }
              return "";
            })
            .join("\n")
        : message.content;

      return `${message.role}: ${content}`;
    })
    .join("\n");
}

export function zeroUsage() {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
}

export function findElementId(prompt: string, label: string): string {
  const lines = prompt.split(/\r?\n/);
  const targetLine = [...lines]
    .reverse()
    .find(
      (line) =>
        line.includes("[") &&
        line.includes("]") &&
        line.toLowerCase().includes(label.toLowerCase()),
    );

  if (!targetLine) {
    throw new Error(`Unable to find "${label}" in the LLM prompt`);
  }

  const match = targetLine.match(/^\s*\[([^\]]+)]/);
  if (!match) {
    throw new Error(`Unable to parse element id for "${label}"`);
  }

  return match[1]!;
}

export class ScriptedLLMClient extends LLMClient {
  public type = "test";
  public hasVision = false;
  public clientOptions = {};
  public readonly calls: RecordedLLMCall[] = [];

  constructor(
    modelName = "openai/gpt-4.1-mini",
    private readonly responders: ScriptedResponder[] = [],
  ) {
    super(modelName);
  }

  async createChatCompletion<T = unknown>(
    options: CreateChatCompletionOptions,
  ): Promise<T> {
    const call: RecordedLLMCall = {
      index: this.calls.length,
      prompt: messagesToText(options.options.messages),
      options: options.options,
      responseModelName: options.options.response_model?.name,
    };
    this.calls.push(call);

    const responder = this.responders[call.index];
    if (!responder) {
      throw new Error(
        `No scripted response configured for LLM call ${call.index}`,
      );
    }

    return (await responder(call)) as T;
  }
}

export function createCloudflareStagehand(
  page: Page,
  llmClient: LLMClient,
  context: BrowserContext = page.context(),
) {
  return new Stagehand({
    env: "CLOUDFLARE",
    browserProvider: async () => ({
      context,
      page,
      env: "CLOUDFLARE",
    }),
    llmClient,
    disablePino: true,
    enableCaching: false,
  });
}

export function instrumentContextNewCDPSession(context: BrowserContext): {
  context: BrowserContext;
  getCount: () => number;
  restore: () => void;
} {
  let count = 0;
  const original = context.newCDPSession.bind(context);

  Object.defineProperty(context, "newCDPSession", {
    configurable: true,
    value: async (...args: Parameters<BrowserContext["newCDPSession"]>) => {
      count += 1;
      return await original(...args);
    },
  });

  return {
    context,
    getCount: () => count,
    restore: () => {
      Object.defineProperty(context, "newCDPSession", {
        configurable: true,
        value: original,
      });
    },
  };
}
