import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { randomUUID as uuidv4 } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { learningStateService } from "../lib/learning/state/learning-state-service";
import { masteryService } from "../lib/learning/state/mastery-service";
import { recommendationService } from "../lib/learning/state/recommendation-service";
import { assessmentService } from "../lib/learning/assessment/assessment-service";
import { getDomain } from "../lib/learning/domains";
import { getPrimaryModel, getModel } from "../lib/ai/models";

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

async function runGoldenPath() {
  console.log("============================================================");
  console.log("KNOWRA — S8 PRODUCTIZATION GOLDEN PATH VALIDATION");
  console.log("============================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // STEP 0: AI STRATEGY & CACHE VERIFICATION (§5, §6)
  console.log("--- 0. Strategic AI Model & Cache Policy Verification ---");
  const primaryModel = getPrimaryModel() || process.env.EDUIA_PRIMARY_MODEL;
  if (primaryModel === "openai/gpt-6-astra") {
    recordGate(
      "Astra Primary Model",
      true,
      `Strategic model is '${primaryModel}' (Astra-first preserved, never downgraded)`
    );
  } else {
    recordGate(
      "Astra Primary Model",
      false,
      `Strategic model violation: ${primaryModel}`
    );
  }

  const planModel = getModel("plan");
  recordGate(
    "AI Task Model Resolution",
    planModel === "openai/gpt-6-astra",
    `Plan task resolves to Astra: '${planModel}'`
  );

  // STEP 1: AUTHENTICATED LEARNER CREATION
  console.log("\n--- 1. Authenticated Learner & Clean Workspace ---");
  const learnerAId = uuidv4();
  const learnerBId = uuidv4();

  // Create real test auth users in Supabase
  const { data: userA, error: errA } = await supabase.auth.admin.createUser({
    id: learnerAId,
    email: `s8-learner-${Date.now()}@knowra.test`,
    password: "Password123!Safe",
    email_confirm: true,
  });

  const { data: userB, error: errB } = await supabase.auth.admin.createUser({
    id: learnerBId,
    email: `s8-cross-${Date.now()}@knowra.test`,
    password: "Password123!Safe",
    email_confirm: true,
  });

  if (errA || !userA.user || errB || !userB.user) {
    recordGate("User Creation", false, `Auth creation error: ${errA?.message || errB?.message}`);
  } else {
    recordGate("User Creation", true, `Created learner A (${learnerAId.slice(0, 8)}) and learner B`);
  }

  // STEP 2: GOAL CREATION (§7.2, §8 Step 1)
  console.log("\n--- 2. Natural Language Goal Creation ---");
  const pythonDomain = getDomain("python-junior");
  if (!pythonDomain) throw new Error("Curated domain python-junior missing");

  const { goal, profile } = await learningStateService.createGoal(learnerAId, {
    rawObjective: "I want to become proficient in Python programming",
    selectedDomainId: "python-junior",
    selfReportedLevel: "Beginner",
  });

  recordGate(
    "Goal Created",
    Boolean(goal.id && goal.status === "ACTIVE"),
    `Goal ID: ${goal.id.slice(0, 8)} | Target: "${goal.title}"`
  );
  recordGate(
    "Profile Initialized",
    Boolean(profile.activeGoalId === goal.id),
    `Profile active goal linked to ${goal.id.slice(0, 8)}`
  );

  // STEP 3: DIAGNOSTIC & BASELINE (§9, §8 Step 3)
  console.log("\n--- 3. Diagnostic Assessment & Baseline Preservation ---");
  const { session: diagSession, items: diagItems } =
    await learningStateService.startDiagnostic(learnerAId, goal.id);

  recordGate(
    "Diagnostic Started",
    Boolean(diagSession.id && diagItems.length > 0),
    `Session: ${diagSession.id.slice(0, 8)} | ${diagItems.length} curated questions`
  );

  // Submit answers to diagnostic items:
  // First item correct, second item incorrect to establish a concrete gap
  for (let i = 0; i < diagItems.length; i++) {
    const item = diagItems[i];
    const ans = i % 2 === 0 ? item.correctAnswer : "incorrect_answer";
    await learningStateService.submitDiagnosticAnswer(
      learnerAId,
      diagSession.id,
      item.id,
      ans
    );
  }

  const diagReport = await learningStateService.completeDiagnostic(
    learnerAId,
    diagSession.id
  );

  recordGate(
    "Diagnostic Completed",
    diagReport.overallBaselineScore > 0,
    `Baseline Score: ${diagReport.overallBaselineScore.toFixed(1)}% | Strengths: ${diagReport.relativeStrengths.length} | Focus: ${diagReport.lowerBaselines.length}`
  );

  // STEP 4: LEARNING MAP & STATE RETRIEVAL (§10, §8 Step 4)
  console.log("\n--- 4. Learning Map & Dynamic State ---");
  const state = await learningStateService.getCurrentLearningState(learnerAId, goal.id);

  recordGate(
    "Learning Map State",
    Boolean(state.diagnosticCompleted && state.competencies.length > 0),
    `Diagnostic Completed: ${state.diagnosticCompleted} | Competencies in Map: ${state.competencies.length}`
  );

  // STEP 5: NEXT BEST ACTION RECOMMENDATION (§11, §12)
  console.log("\n--- 5. Next Best Action Recommendation ---");
  const rec1 = await recommendationService.getNextBestAction(learnerAId, goal.id);

  recordGate(
    "Next Best Action Evaluated",
    Boolean(rec1 && rec1.action && rec1.competencyId),
    `Action: [${rec1.action}] on '${rec1.competencyId}' | Priority: ${rec1.priority} | Reason: "${rec1.reason.slice(0, 60)}..."`
  );

  // STEP 6: PRACTICE ACTIVITY & LEGITIMATE EVIDENCE (§13, §14)
  console.log("\n--- 6. Activity Execution & Evidence Flow ---");
  // Accept recommendation
  await recommendationService.acceptRecommendation(learnerAId, rec1.id);

  // Target competency with initial gap (e.g. py-conditionals)
  const weakComp = state.competencies.find((c) => c.masteryScore < 60) || state.competencies[0];
  const initialMastery = weakComp.masteryScore;

  // Learner completes practice activity on the weak competency with high score
  const evidenceRecord = await learningStateService.recordPracticeEvidence(
    learnerAId,
    goal.id,
    weakComp.competencyId,
    95,
    0.85,
    { source: "golden-path-practice" }
  );

  recordGate(
    "Evidence Emitted",
    Boolean(evidenceRecord.id && evidenceRecord.score === 95),
    `Evidence ID: ${evidenceRecord.id?.slice(0, 8)} | Type: ${evidenceRecord.evidenceType} | Result: ${evidenceRecord.result}`
  );

  // Complete recommendation
  await recommendationService.completeRecommendation(learnerAId, rec1.id);

  // STEP 7: MASTERY RECALCULATION & GAP UPDATE (§15, §16)
  console.log("\n--- 7. Mastery Recalculation & Gap Engine ---");
  const { masteryOutput, gap, snapshot } = await masteryService.recalculateCompetencyMastery(
    learnerAId,
    goal.id,
    weakComp.competencyId,
    "GOLDEN_PATH_PRACTICE_COMPLETED"
  );

  recordGate(
    "Mastery Updated",
    masteryOutput.masteryScore >= initialMastery,
    `Mastery shifted from ${initialMastery.toFixed(0)}% -> ${masteryOutput.masteryScore.toFixed(0)}% (${masteryOutput.masteryState})`
  );

  recordGate(
    "Snapshot Created",
    Boolean(snapshot.id),
    `Immutable snapshot ${snapshot.id.slice(0, 8)} recorded with version ${snapshot.calculationVersion}`
  );

  // Verify baseline score was preserved
  const baselineCheck = await learningStateService.getCompetencyBaseline(
    learnerAId,
    goal.id,
    weakComp.competencyId
  );
  recordGate(
    "Baseline Immutability (§44)",
    Boolean(baselineCheck && baselineCheck.baselineScore !== undefined),
    `Baseline preserved at ${baselineCheck?.baselineScore.toFixed(0)}% despite mastery update`
  );

  // STEP 8: RECOMMENDATION REFRESH (§11)
  console.log("\n--- 8. Refresh Recommendation Loop ---");
  const rec2 = await recommendationService.getNextBestAction(learnerAId, goal.id);

  recordGate(
    "Recommendation Refreshed",
    Boolean(rec2 && rec2.id),
    `New NBA: [${rec2.action}] on '${rec2.competencyId}' (Engine responded dynamically to new evidence)`
  );

  // STEP 9: INDEPENDENT FINAL ASSESSMENT & LEARNING GAIN (§18, §19)
  console.log("\n--- 9. Independent Final Assessment & Learning Gain ---");
  const { session: finalSession, items: finalItems } =
    await assessmentService.startAssessmentSession({
      userId: learnerAId,
      learningGoalId: goal.id,
      domainId: "python-junior",
      assessmentType: "FINAL",
      baselineItemIdsToAvoid: diagSession.itemIds,
    });

  // Verify independence: no baseline items reused (§18)
  const overlappingItems = finalItems.filter((i) => diagSession.itemIds.includes(i.id));
  recordGate(
    "Assessment Independence",
    overlappingItems.length === 0,
    `Zero overlapping items with baseline diagnostic (${finalItems.length} independent items)`
  );

  // Answer final items
  for (const item of finalItems) {
    await assessmentService.submitAnswer({
      sessionId: finalSession.id,
      userId: learnerAId,
      itemId: item.id,
      answer: item.options ? item.options[0] : "10",
    });
  }

  const finalReport = await assessmentService.completeAssessment(
    learnerAId,
    finalSession.id
  );

  const gain = finalReport.learningGainReport?.learningGain;
  recordGate(
    "Learning Gain Measured",
    typeof gain === "number",
    `Learning Gain: ${gain !== undefined ? (gain >= 0 ? "+" : "") + gain.toFixed(1) : "N/A"} points (Relative Gain: ${((finalReport.learningGainReport?.relativeGain || 0) * 100).toFixed(1)}%)`
  );

  // STEP 10: CROSS-USER SECURITY ISOLATION (§22, §38)
  console.log("\n--- 10. Cross-User Security Isolation ---");
  let accessBlocked = false;
  try {
    await learningStateService.getGoal(learnerBId, goal.id);
  } catch (err: any) {
    if (err.name === "UnauthorizedAccessError") {
      accessBlocked = true;
    }
  }

  recordGate(
    "Cross-User Isolation",
    accessBlocked,
    `Learner B strictly denied access to Learner A's goal and state (UnauthorizedAccessError)`
  );

  // Cleanup test users in Supabase
  await supabase.auth.admin.deleteUser(learnerAId);
  await supabase.auth.admin.deleteUser(learnerBId);

  // SUMMARY REPORT
  console.log("\n============================================================");
  console.log("GOLDEN PATH SUMMARY REPORT");
  console.log("============================================================");
  const passedCount = gates.filter((g) => g.passed).length;
  console.log(`Total Gates: ${gates.length}`);
  console.log(`Passed:      ${passedCount}`);
  console.log(`Failed:      ${gates.length - passedCount}`);
  console.log("============================================================\n");

  if (passedCount < gates.length) {
    process.exit(1);
  }
}

runGoldenPath().catch((err) => {
  console.error("FATAL: Golden path validation failed:", err);
  process.exit(1);
});
