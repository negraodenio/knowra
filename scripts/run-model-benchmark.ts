import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import {
  executeEduiaBenchmarkTask,
  verifyAstraStatus,
  verifyModelStatus,
  aggregateBenchmarkRuns,
  generateBenchmarkRecommendation,
  EDUIABENCHMARK_TASKS,
  BenchmarkResult,
  ModelTask,
} from "../lib/ai/evaluation";

async function runLiveBenchmark() {
  console.log("============================================================");
  console.log("S7.6 MODEL BENCHMARK & ASTRA VALIDATION — LIVE OPENROUTER");
  console.log("============================================================\n");

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing from environment.");
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // STEP 1 — ASTRA STATUS AUDIT
  // --------------------------------------------------------------------------
  console.log("STEP 1: Astra Status Audit (§S7.6)");
  const astraStatus = verifyAstraStatus();
  console.log(`- Verified: ${astraStatus.verified}`);
  console.log(`- Status: ${astraStatus.status}`);
  console.log(`- Reason: ${astraStatus.reason}`);
  if (astraStatus.modelId) {
    console.log(`- Configured Model ID: ${astraStatus.modelId}`);
  }
  console.log();

  // --------------------------------------------------------------------------
  // STEP 2 — CANDIDATE MODEL VERIFICATION
  // --------------------------------------------------------------------------
  console.log("STEP 2: Candidate Model Discovery & Verification (§S7.6)");
  const candidateModels = [
    "openai/gpt-4o-mini",
    "deepseek/deepseek-chat",
    "anthropic/claude-3.5-sonnet",
  ];

  for (const model of candidateModels) {
    const status = verifyModelStatus(model);
    console.log(`- Model: ${status.modelId}`);
    console.log(`  Provider: ${status.provider}`);
    console.log(`  Status: ${status.verificationStatus}`);
    console.log(`  Notes: ${status.reason}`);
  }
  console.log();

  // --------------------------------------------------------------------------
  // STEP 3 — LIVE BENCHMARK EXECUTION ACROSS VERIFIED MODELS
  // --------------------------------------------------------------------------
  console.log("STEP 3: Running Live Controlled Benchmark on Verified Models");
  console.log("Controlled scope to minimize costs while gathering empirical evidence.\n");

  // Verified candidate models for live benchmark:
  // 1. Low-cost candidate: openai/gpt-4o-mini
  // 2. High-quality / reasoning candidate: deepseek/deepseek-chat
  const activeModels = ["openai/gpt-4o-mini", "deepseek/deepseek-chat"];

  // 5 key representative EDUIA tasks for live empirical testing:
  const targetTasks: ModelTask[] = [
    "classifier", // low-cost classification
    "diagnostic", // structured diagnosis
    "tutor",      // free text pedagogical explanation
    "assessment", // structured item generation
    "feynman",    // structured misconception rubric evaluation
  ];

  const liveResults: BenchmarkResult[] = [];

  for (const model of activeModels) {
    console.log(`--- Benchmarking Model: ${model} ---`);
    for (const task of targetTasks) {
      process.stdout.write(`  Task [${task.toUpperCase()}] ... `);
      const res = await executeEduiaBenchmarkTask(model, task, 1);
      liveResults.push(res);

      if (res.success) {
        console.log(
          `PASS | Quality: ${res.qualityScore}/100 | Latency: ${res.latencyMs}ms | Tokens: ${res.totalTokens} | Cost: $${res.estimatedCost}`
        );
      } else {
        console.log(
          `FAIL [${res.failureType}] | Reason: ${res.failureReason} | Latency: ${res.latencyMs}ms`
        );
      }
    }
    console.log();
  }

  // --------------------------------------------------------------------------
  // STEP 4 — AGGREGATE SUMMARY
  // --------------------------------------------------------------------------
  console.log("STEP 4: Empirical Task Aggregate Summaries");
  const summaries = aggregateBenchmarkRuns(liveResults);

  console.log("\n| Model | Task | Success | Quality | Latency | Tokens | Cost | Schema | Fail Type |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const s of summaries) {
    const raw = liveResults.find((r) => r.model === s.model && r.task === s.task);
    console.log(
      `| ${s.model} | ${s.task} | ${s.successRate * 100}% | ${s.avgQualityScore}/100 | ${s.avgLatencyMs}ms | ${raw?.totalTokens || 0} | $${s.totalCost} | ${s.schemaValidityRate * 100}% | ${raw?.failureType || "NONE"} |`
    );
  }

  // --------------------------------------------------------------------------
  // STEP 5 — EMPIRICAL RECOMMENDATIONS MATRIX
  // --------------------------------------------------------------------------
  console.log("\nSTEP 5: Benchmark Recommendations Matrix");
  const recommendations = generateBenchmarkRecommendation(summaries, astraStatus);

  console.log(`\nRecommended DEFAULT_MODEL: ${recommendations.defaultModel}`);
  console.log("Recommended Task Overrides:");
  for (const [task, model] of Object.entries(recommendations.taskOverrides)) {
    console.log(`  - ${task.toUpperCase()}_MODEL: ${model}`);
  }
  console.log(`Confidence: ${recommendations.confidence}`);
  console.log(`Reason: ${recommendations.reason}`);
  console.log(`Astra Recommendation: ${recommendations.astraRecommendation}`);

  // Total benchmark cost calculation
  const totalCost = liveResults.reduce((acc, r) => acc + r.estimatedCost, 0);
  console.log(`\nTotal Benchmark Cost: $${Number(totalCost.toFixed(6))}`);

  console.log("\n============================================================");
  console.log("S7.6 LIVE BENCHMARK COMPLETE");
  console.log("============================================================\n");
}

runLiveBenchmark().catch((err) => {
  console.error("Live benchmark failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
