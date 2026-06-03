import type {
  Browser as Browser,
  BrowserContext as BrowserContext,
} from "./page";
import type { Page as PlaywrightPage } from "playwright";

export type StagehandEnv = "LOCAL" | "BROWSERBASE" | "CLOUDFLARE";

export interface StagehandBrowserProvider {
  getBrowser(): Promise<BrowserResult>;
  close?(): Promise<void>;
}

export interface BrowserResult {
  env: StagehandEnv;
  browser?: Browser;
  context: BrowserContext;
  page?: PlaywrightPage;
  debugUrl?: string;
  sessionUrl?: string;
  contextPath?: string;
  sessionId?: string;
}
