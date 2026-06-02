/**
 * This example shows how to use the Stagehand operator to do simple autonomous tasks.
 *
 * This is built off of our open source project, Open Operator: https://operator.browserbase.com
 *
 * To learn more about Stagehand Agents, see: https://docs.stagehand.dev/concepts/agent
 */

import { Stagehand } from "cloudflare-stagehand";
import dotenv from "dotenv";
import StagehandConfig from "@/stagehand.config";
import chalk from "chalk";

// Load environment variables
dotenv.config();

const INSTRUCTION =
  "Go to Google Japan and interact with it in Japanese. Tell me (in English) an authentic recipe that I can make with ingredients found in American grocery stores.";

async function main() {
  console.log(`\n${chalk.bold("Stagehand 🤘 Operator Example")}\n`);

  // Initialize Stagehand
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });

  await stagehand.init();

  try {
    const agent = stagehand.agent();

    // Execute the agent
    console.log(`${chalk.cyan("↳")} Instruction: ${INSTRUCTION}`);
    const result = await agent.execute({
      instruction: INSTRUCTION,
      maxSteps: 20,
    });

    console.log(`${chalk.green("✓")} Execution complete`);
    console.log(`${chalk.yellow("⤷")} Result:`);
    console.log(JSON.stringify(result, null, 2));
    console.log(chalk.white(result.message));
  } catch (error) {
    console.log(`${chalk.red("✗")} Error: ${error}`);
  } finally {
    await stagehand.close();
  }
}

main();
