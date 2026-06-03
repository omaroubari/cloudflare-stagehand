import { endpointURLString } from "@cloudflare/playwright";
import { Stagehand } from "../../lib/index";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      const path = url.pathname.replace("/api/", "");

      switch (path) {
        case "navigate":
          return await handleNavigate(request, env);
        case "act":
          return await handleAct(request, env);
        case "extract":
          return await handleExtract(request, env);
        case "observe":
          return await handleObserve(request, env);
        case "screenshot":
          return await handleScreenshot(request, env);
        case "status":
          return handleStatus();
        default:
          return Response.json({ error: "Unknown endpoint" }, { status: 400 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

async function withStagehand(
  body: Record<string, unknown>,
  env: Env,
  fn: (stagehand: Stagehand) => Promise<Response>,
): Promise<Response> {
  const modelName = (body.modelName as string) || "google/gemini-3-flash";
  const cdpUrl = endpointURLString(env.BROWSER);

  const stagehand = new Stagehand({
    env: "CLOUDFLARE",
    modelName,
    modelClientOptions: {
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    },
    apiKey: process.env.CLOUDFLARE_API_TOKEN,
    cloudflareBrowserConnectOptions: {
      cdpUrl,
    },
    verbose: 2,
    logger: console.log,
    disablePino: true,
    enableCaching: false,
  });

  await stagehand.init();

  let response: Response | undefined;
  let operationError: unknown;
  let closeError: unknown;

  try {
    response = await fn(stagehand);
  } catch (error) {
    operationError = error;
  } finally {
    try {
      await stagehand.close();
    } catch (error) {
      closeError = error;
    }
  }

  if (operationError !== undefined) {
    throw operationError;
  }

  if (closeError !== undefined) {
    throw closeError;
  }

  return response as Response;
}

async function handleNavigate(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { url: string; modelName?: string };
  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  return withStagehand(body, env, async (stagehand) => {
    await stagehand.page.goto(body.url, { waitUntil: "domcontentloaded" });

    return Response.json({
      success: true,
      url: stagehand.page.url(),
      title: await stagehand.page.title().catch(() => ""),
    });
  });
}

async function handleAct(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    url: string;
    action: string;
    modelName?: string;
  };
  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }
  if (!body.action) {
    return Response.json({ error: "action is required" }, { status: 400 });
  }

  return withStagehand(body, env, async (stagehand) => {
    await stagehand.page.goto(body.url, { waitUntil: "domcontentloaded" });
    const result = await stagehand.page.act(body.action);

    return Response.json({
      success: result.success,
      message: result.message,
      action: result.action,
    });
  });
}

async function handleExtract(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    url: string;
    instruction?: string;
    modelName?: string;
  };
  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  return withStagehand(body, env, async (stagehand) => {
    await stagehand.page.goto(body.url, { waitUntil: "domcontentloaded" });
    const result = await stagehand.page.extract({
      instruction:
        body.instruction || "Extract the main content from this page",
    });

    return Response.json({
      success: true,
      extraction: result,
    });
  });
}

async function handleObserve(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    url: string;
    instruction?: string;
    modelName?: string;
  };
  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  return withStagehand(body, env, async (stagehand) => {
    await stagehand.page.goto(body.url, { waitUntil: "domcontentloaded" });
    const results = await stagehand.page.observe({
      instruction: body.instruction || "Find interactive elements on this page",
    });

    return Response.json({
      success: true,
      observations: results,
    });
  });
}

async function handleScreenshot(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const url = body.url as string | undefined;
  if (!url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  return withStagehand(body, env, async (stagehand) => {
    await stagehand.page.goto(url, { waitUntil: "domcontentloaded" });
    const buffer = await stagehand.page.screenshot({ fullPage: false });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
      },
    });
  });
}

function handleStatus(): Response {
  return Response.json({
    initialized: false,
    sessionId: null,
    message: "Stateless mode - no persistent sessions",
  });
}
