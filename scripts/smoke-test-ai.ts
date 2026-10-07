import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { aiGateway } from "../lib/ai/gateway";
import { getModel } from "../lib/ai/models";

async function runSmokeTest() {
  console.log("Starting OpenRouter runtime smoke test...");

  // 1. Verify model resolution from registry
  const configuredClassifierModel = getModel("classifier");
  console.log(`Task 'classifier' resolved to model: ${configuredClassifierModel}`);

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing from environment.");
    process.exit(1);
  }

  // 2. Perform a single minimal inexpensive invocation
  const result = await aiGateway.generateText({
    task: "classifier",
    systemPrompt: "You are a concise classification assistant. Reply in one word.",
    userPrompt: "Classify: 2 + 2 = 4 (VALID or INVALID)",
    promptVersion: "SMOKE_TEST_V1",
    temperature: 0.0,
    maxTokens: 10,
  });

  console.log("OpenRouter response received successfully!");
  console.log(`Output: "${result.data.trim()}"`);
  console.log(`Reported Model: ${result.model}`);
  console.log(`Tokens Used: ${result.usage.totalTokens} (Prompt: ${result.usage.promptTokens}, Completion: ${result.usage.completionTokens})`);
  console.log(`Estimated Cost: $${result.usage.estimatedCost}`);
  console.log(`Telemetry Status: ${result.usage.status}`);
  console.log("SMOKE TEST STATUS: PASS");
}

runSmokeTest().catch((err) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
