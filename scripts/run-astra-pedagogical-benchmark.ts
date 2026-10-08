import { config } from "dotenv";
import { resolve } from "path";

// Load local environment
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import {
  executeEduiaBenchmarkTask,
  verifyAstraStatus,
  verifyModelStatus,
  aggregateBenchmarkRuns,
  generateBenchmarkRecommendation,
  EDUIABENCHMARK_TASKS,
  BenchmarkResult,
  ModelTask,
  BENCHMARK_VERSION,
} from "../lib/ai/evaluation";
import { openRouterClient } from "../lib/ai/openrouter";

async function runAstraPedagogicalBenchmark() {
  console.log("================================================================================");
  console.log("S7.7 ASTRA-FIRST PEDAGOGICAL BENCHMARK & EVALUATION ENGINE");
  console.log(`Version: ${BENCHMARK_VERSION}`);
  console.log("================================================================================\n");

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing from environment. Live validation blocked.");
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // STEP 1 — ASTRA ENDPOINT DISCOVERY & VERIFICATION
  // --------------------------------------------------------------------------
  console.log("STEP 1: Strategic Primary Astra Verification (§S7.7 Section 3, 15)");
  const configuredPrimary = process.env.EDUIA_PRIMARY_MODEL?.trim() || "openai/gpt-6-astra";
  console.log(`- Configured Strategic Primary Target: ${configuredPrimary}`);

  let verifiedAstraId: string | undefined;
  let isAstraCallable = false;

  try {
    const probeResponse = await openRouterClient.complete({
      model: configuredPrimary,
      messages: [{ role: "user", content: "Ping: Respond with JSON {\"status\": \"ok\"}" }],
      responseFormat: { type: "json_object" },
      maxTokens: 50,
      temperature: 0.0,
    });

    if (probeResponse.content.includes("ok")) {
      verifiedAstraId = configuredPrimary;
      isAstraCallable = true;
      console.log(`- Provider Verification: SUCCESS`);
      console.log(`- Authoritative Live Astra Model ID: ${verifiedAstraId}`);
      console.log(`- Prompt Tokens: ${probeResponse.promptTokens}, Completion Tokens: ${probeResponse.completionTokens}\n`);
    } else {
      console.log(`- Provider Probe returned unexpected payload: ${probeResponse.content}`);
    }
  } catch (err: unknown) {
    console.log(`- Provider Probe failed: ${err instanceof Error ? err.message : String(err)}`);
    console.log(`- ASTRA VALIDATION BLOCKED for live execution.\n`);
  }

  // --------------------------------------------------------------------------
  // STEP 2 — BENCHMARK EXECUTION ACROSS PEDAGOGICAL TASKS
  // --------------------------------------------------------------------------
  const candidateModels: string[] = [];
  if (isAstraCallable && verifiedAstraId) {
    candidateModels.push(verifiedAstraId);
  }
  candidateModels.push("openai/gpt-4o-mini"); // Baseline comparator

  const representativeTasks: ModelTask[] = [
    "tutor",
    "diagnostic",
    "feynman",
    "assessment",
    "plan",
    "competency",
    "material",
    "classifier",
  ];

  console.log("STEP 2: Executing Empirical Pedagogical Tasks");
  console.log(`- Models to Benchmark: ${candidateModels.join(", ")}`);
  console.log(`- Pedagogical Tasks: ${representativeTasks.join(", ")}\n`);

  const allResults: BenchmarkResult[] = [];

  for (const model of candidateModels) {
    const isAstra = model.toLowerCase().includes("astra");
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Model: ${model} (${isAstra ? "STRATEGIC PRIMARY TARGET" : "BASELINE COMPARATOR"})`);
    console.log(`--------------------------------------------------------------------------------`);

    for (const task of representativeTasks) {
      process.stdout.write(`  [${task.toUpperCase().padEnd(12)}] ... `);
      const res = await executeEduiaBenchmarkTask(model, task, 1);
      allResults.push(res);

      if (res.success) {
        console.log(
          `PASS | Quality: ${String(res.qualityScore).padStart(3)}/100 | Ped: ${String(res.pedagogicalScore ?? res.qualityScore).padStart(3)}/100 | Latency: ${String(res.latencyMs).padStart(5)}ms | Tokens: ${String(res.totalTokens).padStart(4)} | Cost: $${res.estimatedCost.toFixed(5)}`
        );
        if (res.pedagogicalDimensions && res.pedagogicalDimensions.length > 0) {
          for (const d of res.pedagogicalDimensions) {
            console.log(`       └─ ${d.name.padEnd(35)}: ${String(d.score).padStart(3)}/100 [${d.rationale}]`);
          }
        }
      } else {
        console.log(
          `FAIL [${res.failureType}] | Reason: ${res.failureReason} | Latency: ${res.latencyMs}ms`
        );
      }
    }
    console.log();
  }

  // --------------------------------------------------------------------------
  // STEP 3 — AGGREGATION & DECISION MATRIX GENERATION
  // --------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("STEP 3: S7.7 MODEL DECISION MATRIX (§S7.7 Section 11)");
  console.log("================================================================================\n");

  const summaries = aggregateBenchmarkRuns(allResults);
  const astraStatus = verifyAstraStatus();
  const recommendations = generateBenchmarkRecommendation(summaries, astraStatus);

  console.log(
    "| Task         | Astra Quality | Mini Quality | Astra Cost   | Mini Cost    | Class | Preferred Model     |"
  );
  console.log(
    "|--------------|---------------|--------------|--------------|--------------|-------|---------------------|"
  );

  if (recommendations.decisionMatrix) {
    for (const m of recommendations.decisionMatrix) {
      console.log(
        `| ${m.task.padEnd(12)} | ${String(m.astraQuality).padStart(13)} | ${String(m.miniQuality).padStart(12)} | $${m.astraCost.toFixed(5).padStart(10)} | $${m.miniCost.toFixed(5).padStart(10)} |   ${m.classification}   | ${m.preferred.padEnd(19)} |`
      );
    }
  }

  console.log("\nClassification Legend:");
  console.log("  A — Astra clearly superior (pedagogical delta >= +15)");
  console.log("  B — Astra materially better (qualitative alignment & reasoning superiority)");
  console.log("  C — Roughly equivalent");
  console.log("  D — Cheaper model sufficient (low-risk tasks like classifier)\n");

  console.log("================================================================================");
  console.log("FINAL STRATEGIC ROUTING RECOMMENDATIONS (§S7.7)");
  console.log("================================================================================");
  console.log(`- Strategic Default Model (EDUIA_PRIMARY_MODEL): ${recommendations.defaultModel}`);
  console.log(`- Astra Recommendation: ${recommendations.astraRecommendation}`);
  console.log(`- Rationale: ${recommendations.reason}`);
  console.log("\nTask-by-Task Final Preferred Routing:");
  for (const [task, model] of Object.entries(recommendations.taskOverrides)) {
    console.log(`  - ${task.padEnd(14)} -> ${model}`);
  }
  console.log("================================================================================\n");

  return {
    allResults,
    summaries,
    recommendations,
  };
}

// Execute if called directly
runAstraPedagogicalBenchmark().catch((err) => {
  console.error("Benchmark failed with uncaught exception:", err);
  process.exit(1);
});
