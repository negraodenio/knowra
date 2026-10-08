import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { aiGateway } from "../lib/ai/gateway";
import { aiModelOrchestrator } from "../lib/ai/orchestrator";
import { telemetryService } from "../lib/ai/usage";

async function runSmokeTest() {
  console.log("============================================================");
  console.log("S7.5 AI MODEL ORCHESTRATOR — OPENROUTER RUNTIME SMOKE TEST");
  console.log("============================================================\n");

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing from environment.");
    process.exit(1);
  }

  // 1. Task -> Orchestrator Selection
  console.log("Step 1: Orchestrating model selection for task 'classifier'...");
  const decision = aiModelOrchestrator.selectModel({
    task: "classifier",
    latencyRequirement: "LOW",
    costSensitivity: "HIGH",
  });

  console.log(`✓ Selected Model: ${decision.model}`);
  console.log(`✓ Provider: ${decision.provider}`);
  console.log(`✓ Policy Version: ${decision.policyVersion}`);
  console.log(`✓ Selection Reason: ${decision.reason}`);
  console.log(`✓ Capabilities: ${decision.capabilities.join(", ")}`);

  // 2. Orchestrated Model Execution via AI Gateway & OpenRouter
  console.log("\nStep 2: Executing pedagogical task via AI Gateway & OpenRouter...");
  const result = await aiGateway.generateText({
    task: "classifier",
    systemPrompt: "You are a concise educational classification assistant. Reply in one word.",
    userPrompt: "Classify: 2 + 2 = 4 (VALID or INVALID)",
    promptVersion: "SMOKE_TEST_V1",
    temperature: 0.0,
    maxTokens: 10,
  });

  console.log("✓ OpenRouter response received successfully!");
  console.log(`✓ Output: "${result.data.trim()}"`);
  console.log(`✓ Executed Model: ${result.model}`);
  console.log(`✓ Tokens Used: ${result.usage.totalTokens} (Prompt: ${result.usage.promptTokens}, Completion: ${result.usage.completionTokens})`);
  console.log(`✓ Estimated Cost: $${result.usage.estimatedCost}`);
  console.log(`✓ Telemetry Status: ${result.usage.status}`);
  console.log(`✓ Telemetry Orchestration Policy: ${result.usage.orchestrationPolicy}`);
  console.log(`✓ Telemetry Selection Reason: ${result.usage.selectionReason}`);

  // 3. Model Observability Verification
  console.log("\nStep 3: Verifying model observability telemetry aggregation...");
  const stats = telemetryService.getModelObservabilityStats();
  const key = `${result.model}:classifier`;
  const modelStats = stats[key];

  if (!modelStats) {
    throw new Error(`Observability stats not found for key: ${key}`);
  }

  console.log(`✓ Observability Entry Verified:`);
  console.log(`  - Model: ${modelStats.model}`);
  console.log(`  - Task: ${modelStats.task}`);
  console.log(`  - Call Count: ${modelStats.callCount}`);
  console.log(`  - Success Count: ${modelStats.successCount}`);
  console.log(`  - Avg Latency: ${modelStats.avgLatencyMs}ms`);
  console.log(`  - Total Cost: $${modelStats.estimatedCost}`);

  console.log("\n============================================================");
  console.log("S7.5 OPENROUTER RUNTIME SMOKE TEST: 100% PASS");
  console.log("============================================================");
}

runSmokeTest().catch((err) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
