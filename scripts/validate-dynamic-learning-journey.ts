import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { randomUUID as uuidv4 } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { learningStateService, UnauthorizedAccessError } from "../lib/learning/state/learning-state-service";
import { recommendationService } from "../lib/learning/state/recommendation-service";
import { masteryService } from "../lib/learning/state/mastery-service";
import { getDomain } from "../lib/learning/domains";
import { dynamicCurriculumRegistry } from "../lib/learning/curriculum/dynamic-registry";
import { getCuratedCompetenciesByDomain } from "../lib/learning/curriculum";
import { getDiagnosticItemsByDomain } from "../lib/learning/diagnostic/curriculum";

interface GateResult {
  step: string;
  passed: boolean;
  details: string;
}

const gates: GateResult[] = [];

function recordGate(step: string, passed: boolean, details: string) {
  gates.push({ step, passed, details });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${icon}] ${step}: ${details}`);
}

async function runValidation() {
  console.log("============================================================");
  console.log("KNOWRA — DYNAMIC LEARNING ENGINE: END-TO-END VALIDATION GATE");
  console.log("============================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // =========================================================================
  // STEP 1: AUTHENTICATED USER & GOAL RETRIEVAL/CREATION
  // =========================================================================
  console.log("--- 1. Authenticated Learner & Goal Verification ---");
  const existingUserId = "1335ce7a-9c6a-48c2-a9ba-406d81cc6bb8";
  const existingGoalId = "42e45de7-1e64-4df0-bfae-b6dc689ebe64";

  // Verify the real user and goal in Supabase
  const { data: goalRow, error: goalErr } = await supabase
    .from("learning_goals")
    .select("*")
    .eq("id", existingGoalId)
    .single();

  if (goalErr || !goalRow) {
    recordGate(
      "Goal Retrieval",
      false,
      `Failed to find Cerrado goal: ${goalErr?.message}`
    );
    return;
  }

  recordGate(
    "Goal Retrieval",
    true,
    `Retrieved Cerrado goal '${goalRow.id.slice(0, 8)}' for learner '${existingUserId.slice(0, 8)}' (Domain: ${goalRow.domain_id})`
  );

  const domainId = goalRow.domain_id;

  // =========================================================================
  // STEP 2 & 3: COHERENT COMPETENCY GRAPH & DOMAIN INTEGRITY
  // =========================================================================
  console.log("\n--- 2 & 3. Dynamic Competency Graph & Domain Integrity ---");
  await dynamicCurriculumRegistry.loadDomainFromDatabase(domainId);
  const domain = getDomain(domainId);

  recordGate(
    "Dynamic Domain Loaded",
    Boolean(domain && domain.id === domainId),
    `Domain registered: ${domain?.name} (isCurated: ${domain?.isCurated})`
  );

  const competencies = getCuratedCompetenciesByDomain(domainId);
  recordGate(
    "Competency Count",
    competencies.length >= 5,
    `Found ${competencies.length} generated competencies (Expected >= 5)`
  );

  const allBelongToDomain = competencies.every((c) => c.domainId === domainId);
  recordGate(
    "Domain Association",
    allBelongToDomain,
    `Every competency belongs to '${domainId}' (no leaking into python/math/excel)`
  );

  // Check DAG acyclicity and topological order
  const mapVersion = dynamicCurriculumRegistry.getMapVersion(domainId);
  const hasValidDAG = Boolean(mapVersion && mapVersion.topologicalOrder.length === competencies.length);
  recordGate(
    "Acyclic Prerequisite DAG",
    hasValidDAG,
    `DAG topological order built successfully: ${mapVersion?.topologicalOrder.length} nodes ordered`
  );

  // Verify educational prerequisite logic
  const firstComp = competencies.find((c) => c.prerequisites.length === 0);
  recordGate(
    "Foundational Ordering",
    Boolean(firstComp),
    `Found root foundational node with 0 prerequisites: '${firstComp?.title}'`
  );

  // =========================================================================
  // STEP 4 & 5: DIAGNOSTIC GENERATION, ANSWERING & COMPLETION
  // =========================================================================
  console.log("\n--- 4 & 5. Diagnostic Assessment & Baseline Aggregation ---");
  const diagItems = getDiagnosticItemsByDomain(domainId);
  recordGate(
    "Diagnostic Items Available",
    diagItems.length >= competencies.length,
    `Retrieved ${diagItems.length} diagnostic items for domain '${domainId}'`
  );

  // Check educational alignment of diagnostic items
  const diagAllHaveOptions = diagItems.every((d) => d.options && d.options.length >= 2 && Boolean(d.correctAnswer));
  recordGate(
    "Diagnostic Question Quality",
    diagAllHaveOptions,
    `All ${diagItems.length} diagnostic items have structured options, correct answers, and pedagogical prompts`
  );

  // Start diagnostic session via real Learning Engine service
  const { session: diagSession, items: sessionItems } = await learningStateService.startDiagnostic(
    existingUserId,
    existingGoalId
  );
  recordGate(
    "Diagnostic Started",
    Boolean(diagSession.id && sessionItems.length > 0),
    `Session ID: ${diagSession.id.slice(0, 8)} | ${sessionItems.length} questions presented`
  );

  // Answer diagnostic items with mixed results (to establish strengths & gaps)
  for (let i = 0; i < sessionItems.length; i++) {
    const item = sessionItems[i];
    // First 4 correct, remaining incorrect
    const answerToSubmit = i < 4 ? item.correctAnswer : "Alternativa Incorreta Teste";
    await learningStateService.submitDiagnosticAnswer(
      existingUserId,
      diagSession.id,
      item.id,
      answerToSubmit
    );
  }

  const diagReport = await learningStateService.completeDiagnostic(
    existingUserId,
    diagSession.id
  );

  recordGate(
    "Diagnostic Completed",
    diagReport.overallBaselineScore > 0,
    `Baseline Score: ${diagReport.overallBaselineScore.toFixed(1)}% | Strengths: ${diagReport.relativeStrengths.length} | Lower Baselines: ${diagReport.lowerBaselines.length}`
  );

  // =========================================================================
  // STEP 6: BASELINE EVIDENCE & LEARNING STATE PERSISTENCE
  // =========================================================================
  console.log("\n--- 6. State Persistence & Baseline Preservation ---");
  const state = await learningStateService.getCurrentLearningState(existingUserId, existingGoalId);

  recordGate(
    "Learning State Retrieved",
    state.diagnosticCompleted && state.competencies.length > 0,
    `Diagnostic Completed: ${state.diagnosticCompleted} | Active Competencies in State: ${state.competencies.length}`
  );

  // Verify baseline is preserved in DB
  const { data: dbCompStates } = await supabase
    .from("competency_states")
    .select("*")
    .eq("user_id", existingUserId)
    .eq("learning_goal_id", existingGoalId);

  const baselineSaved = Boolean(dbCompStates && dbCompStates.length > 0 && dbCompStates.some((s) => s.baseline_score > 0));
  recordGate(
    "Database Persistence",
    baselineSaved,
    `Supabase 'competency_states' contains ${dbCompStates?.length} persisted records with valid baselines`
  );

  // =========================================================================
  // STEP 7: RETRIEVE NEXT BEST ACTION
  // =========================================================================
  console.log("\n--- 7. Next Best Action Recommendation ---");
  const recommendation = await recommendationService.getNextBestAction(existingUserId, existingGoalId);

  recordGate(
    "Next Best Action Evaluated",
    Boolean(recommendation && recommendation.action && recommendation.competencyId),
    `Recommended [${recommendation?.action}] on '${recommendation?.competencyId}' (Priority: ${recommendation?.priority}, Reason: "${recommendation?.reason?.slice(0, 60)}...")`
  );

  // =========================================================================
  // STEP 8: GENERATE REAL ACTIVITY FOR RECOMMENDED COMPETENCY
  // =========================================================================
  console.log("\n--- 8. Activity Generation & Contextual Alignment ---");
  const targetCompId = recommendation!.competencyId;
  const targetComp = dynamicCurriculumRegistry.getCompetencyById(targetCompId)!;

  recordGate(
    "Competency Resolved",
    Boolean(targetComp),
    `Resolved competency: '${targetComp?.title}' (${targetComp?.category})`
  );

  // Test the Activity API endpoint via HTTP fetch (running local dev server)
  const activityUrl = `http://localhost:3000/api/learning/activity?goalId=${existingGoalId}&competencyId=${targetCompId}&action=${recommendation!.action}`;
  const actRes = await fetch(activityUrl, {
    headers: { "x-user-id": existingUserId },
  });

  const actData = actRes.ok ? await actRes.json() : null;
  recordGate(
    "Activity API GET",
    actRes.status === 200 && Boolean(actData?.activity?.practice),
    `Status ${actRes.status} | Activity Title: "${actData?.activity?.title}" | Prompt: "${actData?.activity?.practice?.prompt?.slice(0, 60)}..."`
  );

  // =========================================================================
  // STEP 9 & 10: SUBMIT ACTIVITY ANSWER & EVALUATION CRITERIA
  // =========================================================================
  console.log("\n--- 9 & 10. Activity Submission & Pedagogical Evaluation ---");
  const submitUrl = "http://localhost:3000/api/learning/activity/submit";

  // Test that empty / invalid submission does NOT award mastery
  const invalidRes = await fetch(submitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": existingUserId },
    body: JSON.stringify({
      goalId: existingGoalId,
      competencyId: targetCompId,
      action: recommendation!.action,
      score: 150, // Invalid score > 100
      response: "test",
    }),
  });
  recordGate(
    "Score Validation Security",
    invalidRes.status === 400,
    `Rejected invalid score (>100) with status ${invalidRes.status}`
  );

  // Submit legitimate practice answer
  const submitRes = await fetch(submitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": existingUserId },
    body: JSON.stringify({
      goalId: existingGoalId,
      competencyId: targetCompId,
      action: recommendation!.action,
      score: 95,
      response: "O Cerrado apresenta adaptações geomorfológicas e edáficas únicas, com solos profundos, ácidos e ricos em ferro e alumínio.",
      recommendationId: recommendation!.id,
      metadata: {
        itemPrompt: actData?.activity?.practice?.prompt,
        category: targetComp.category,
      },
    }),
  });

  const submitRaw = await submitRes.text();
  let submitData: any = null;
  try {
    submitData = JSON.parse(submitRaw);
  } catch {
    console.log("Submit raw text:", submitRaw);
  }
  if (!submitRes.ok) {
    console.error("SUBMIT FAILED ERROR PAYLOAD:", submitData || submitRaw);
  }

  recordGate(
    "Activity Submission API",
    submitRes.status === 200 && Boolean(submitData?.success),
    `Status ${submitRes.status} | Evidence ID: ${submitData?.evidence?.id?.slice(0, 8)} | Result: ${submitData?.evidence?.result}`
  );

  // =========================================================================
  // STEP 11: EVIDENCE PERSISTENCE & MASTERY SCORE UPDATE
  // =========================================================================
  console.log("\n--- 11. Mastery & Evidence Ledger Verification ---");
  const newMasteryScore = submitData?.masteryOutput?.masteryScore;
  recordGate(
    "Mastery Update",
    typeof newMasteryScore === "number" && newMasteryScore > 0,
    `Mastery updated to ${newMasteryScore}% (State: ${submitData?.masteryOutput?.masteryState})`
  );

  // Verify immutable evidence record in Supabase
  const { data: evidenceRow } = await supabase
    .from("evidence")
    .select("*")
    .eq("id", submitData?.evidence?.id)
    .single();

  recordGate(
    "Evidence In Supabase",
    Boolean(evidenceRow && evidenceRow.score === 95),
    `Persisted in 'evidence' table: Score ${evidenceRow?.score}% | Confidence ${evidenceRow?.confidence}`
  );

  // Verify immutable snapshot in Supabase
  let { data: snapshotRow } = await supabase
    .from("mastery_snapshots")
    .select("*")
    .eq("id", submitData?.snapshot?.id)
    .maybeSingle();

  if (!snapshotRow) {
    const { data: latestSnapshot } = await supabase
      .from("mastery_snapshots")
      .select("*")
      .eq("user_id", existingUserId)
      .eq("competency_id", targetCompId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    snapshotRow = latestSnapshot;
  }

  recordGate(
    "Mastery Snapshot In Supabase",
    Boolean(snapshotRow && snapshotRow.mastery_score === newMasteryScore),
    `Persisted in 'mastery_snapshots' table: ID ${snapshotRow?.id?.slice(0, 8)} | Score ${snapshotRow?.mastery_score}%`
  );

  // =========================================================================
  // STEP 12: UPDATED LEARNING STATE & NEXT RECOMMENDATION
  // =========================================================================
  console.log("\n--- 12. Dynamic Adaptive Loop Response ---");
  const nextRec = submitData?.nextRecommendation;
  recordGate(
    "Refreshed Recommendation",
    Boolean(nextRec && nextRec.id !== recommendation!.id),
    `New recommendation generated: [${nextRec?.action}] on '${nextRec?.competencyId}'`
  );

  // =========================================================================
  // STEP 13: REFRESH RESILIENCE (COLD HYDRATION)
  // =========================================================================
  console.log("\n--- 13. Page Refresh & Cold Hydration Persistence ---");
  // Test /api/learning/state route via HTTP as a learner refreshing the browser
  const stateRes = await fetch(`http://localhost:3000/api/learning/state?goalId=${existingGoalId}`, {
    headers: { "x-user-id": existingUserId },
  });
  const refreshedState = stateRes.ok ? await stateRes.json() : null;

  recordGate(
    "State API Endpoint (Browser Refresh)",
    stateRes.status === 200 && Boolean(refreshedState?.competencies?.length > 0),
    `Refreshed state has ${refreshedState?.competencies?.length} competency states | Map Version: ${refreshedState?.mapVersion}`
  );

  const updatedCompState = refreshedState?.competencies?.find((c: any) => c.competencyId === targetCompId);
  recordGate(
    "Mastery Persistence on Refresh",
    Boolean(updatedCompState && updatedCompState.masteryScore === newMasteryScore),
    `Target competency '${targetCompId}' holds persisted mastery ${updatedCompState?.masteryScore}%`
  );

  // =========================================================================
  // SECTION 4: EDUCATIONAL QUALITY CHECKS
  // =========================================================================
  console.log("\n--- Educational Quality Verification ---");
  // Check Cerrado content accuracy
  const cerradoKeywords = ["cerrado", "centro-oeste", "fitofisionomia", "savana", "biodiversidade", "solo", "vereda"];
  const titlesCombined = competencies.map((c) => (c.title + " " + c.description).toLowerCase()).join(" ");
  const hasCerradoConcepts = cerradoKeywords.filter((k) => titlesCombined.includes(k));

  recordGate(
    "Domain Domain-Relevance",
    hasCerradoConcepts.length >= 4,
    `Curriculum covers genuine Brazilian Cerrado themes: ${hasCerradoConcepts.join(", ")}`
  );

  // =========================================================================
  // SECTION 5: SECURITY & CROSS-USER ISOLATION
  // =========================================================================
  console.log("\n--- Security & Multi-Tenant Isolation ---");
  const unauthorizedUserId = uuidv4();

  // Try to access the Cerrado goal with unauthorized user ID
  try {
    await learningStateService.getGoal(unauthorizedUserId, existingGoalId);
    recordGate("Cross-User Goal Access Blocked", false, "Allowed unauthorized user to access goal!");
  } catch (err: unknown) {
    const isDenied = err instanceof UnauthorizedAccessError;
    recordGate(
      "Cross-User Goal Access Blocked",
      isDenied,
      `Access correctly denied: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Try to access learning state endpoint with unauthorized user ID
  const forbiddenRes = await fetch(`http://localhost:3000/api/learning/state?goalId=${existingGoalId}`, {
    headers: { "x-user-id": unauthorizedUserId },
  });
  recordGate(
    "API Cross-User Isolation (HTTP 403)",
    forbiddenRes.status === 403,
    `HTTP /api/learning/state returned ${forbiddenRes.status} for unauthorized user`
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n============================================================");
  console.log("DYNAMIC CURRICULUM VALIDATION GATE SUMMARY");
  console.log("============================================================");
  const total = gates.length;
  const passed = gates.filter((g) => g.passed).length;
  const failed = total - passed;
  console.log(`Total Gates: ${total}`);
  console.log(`Passed:      ${passed}`);
  console.log(`Failed:      ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error("FATAL ERROR in dynamic validation gate:", err);
  process.exit(1);
});
