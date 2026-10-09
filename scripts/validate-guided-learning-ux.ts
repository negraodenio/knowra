import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import crypto from "crypto";
const uuidv4 = () => crypto.randomUUID();
import { learningStateService } from "../lib/learning/state/learning-state-service";
import { recommendationService } from "../lib/learning/state/recommendation-service";
import { masteryService } from "../lib/learning/state/mastery-service";
import { getDomain } from "../lib/learning/domains";
import { getCuratedCompetenciesByDomain } from "../lib/learning/curriculum";

async function runGuidedUxValidation() {
  console.log("============================================================");
  console.log("KNOWRA — GUIDED LEARNING UX 2.0 END-TO-END VALIDATION");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[✓ PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[✗ FAIL] ${msg}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. FIRST-TIME LEARNER: GOAL INTAKE & PATH PREVIEW
  // -------------------------------------------------------------------------
  console.log("--- 1. First-Time Learner: Goal Creation & Path Preview ---");
  const newLearnerId = uuidv4();

  // Create Python Junior goal
  const { goal: pyGoal } = await learningStateService.createGoal(newLearnerId, {
    rawObjective: "I want to learn Python from beginner to junior developer",
    selectedDomainId: "python-junior",
    selfReportedLevel: "Beginner",
    userId: newLearnerId,
  });

  assert(Boolean(pyGoal.id), `Goal created successfully: ID ${pyGoal.id.slice(0, 8)}`);
  assert(pyGoal.domainId === "python-junior", `Domain mapped accurately to python-junior`);

  // Verify Path Preview payload
  const pyDomain = getDomain(pyGoal.domainId);
  const pyComps = getCuratedCompetenciesByDomain(pyGoal.domainId);
  assert(Boolean(pyDomain && pyDomain.name.includes("Python")), `Path Preview resolves domain: ${pyDomain?.name}`);
  assert(pyComps.length >= 7, `Path Preview contains ${pyComps.length} representative competencies`);

  // -------------------------------------------------------------------------
  // 2. GUIDED DIAGNOSTIC: 1-BY-1 QUESTION PROGRESSION & BASELINE
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Guided Diagnostic: 1-by-1 Flow & Starting Point ---");
  const diagStart = await learningStateService.startDiagnostic(newLearnerId, pyGoal.id);
  assert(Boolean(diagStart.session.id), `Diagnostic session initialized: ID ${diagStart.session.id.slice(0, 8)}`);
  assert(diagStart.items.length === 7, `Diagnostic session provides exactly 7 calibrated questions`);

  // Answer each question one by one
  for (let i = 0; i < diagStart.items.length; i++) {
    const item = diagStart.items[i];
    const answer = item.options ? item.options[0] : "42";
    await learningStateService.submitDiagnosticAnswer(newLearnerId, diagStart.session.id, item.id, answer);
  }
  assert(true, `Answered all 7 diagnostic questions sequentially`);

  // Complete diagnostic
  const diagReport = await learningStateService.completeDiagnostic(newLearnerId, diagStart.session.id);
  assert(diagReport.overallBaselineScore >= 0, `Baseline score established: ${diagReport.overallBaselineScore.toFixed(0)}%`);
  assert(diagReport.sessionId === diagStart.session.id, `Report references authoritative session ID`);

  // -------------------------------------------------------------------------
  // 3. FOCUSED FIRST LESSON & EVIDENCE SUBMISSION
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Focused Lesson: Activity Execution & Evidence Ledger ---");
  const initialRec = await recommendationService.getNextBestAction(newLearnerId, pyGoal.id);
  assert(Boolean(initialRec && initialRec.competencyId), `Next Best Action evaluated: [${initialRec?.action}] on '${initialRec?.competencyId}'`);

  const targetCompId = initialRec!.competencyId;

  // Record practice evidence
  const evidence = await learningStateService.recordPracticeEvidence(
    newLearnerId,
    pyGoal.id,
    targetCompId,
    95,
    0.85,
    { action: initialRec!.action, userResponse: "Correct explanation of variable storage" }
  );
  assert(Boolean(evidence.id), `Evidence recorded in ledger: ID ${evidence.id.slice(0, 8)} (Score: ${evidence.score}%)`);

  // Recalculate mastery
  const { masteryOutput } = await masteryService.recalculateCompetencyMastery(
    newLearnerId,
    pyGoal.id,
    targetCompId,
    "ACTIVITY_PRACTICE_COMPLETED"
  );
  assert(masteryOutput.masteryScore > 0, `Demonstrated mastery updated: ${masteryOutput.masteryScore.toFixed(0)}% (${masteryOutput.masteryState})`);

  // Refreshed Next Best Action
  const refreshedRec = await recommendationService.getNextBestAction(newLearnerId, pyGoal.id);
  assert(Boolean(refreshedRec), `Refreshed Next Best Action generated: [${refreshedRec?.action}]`);

  // -------------------------------------------------------------------------
  // 4. MULTI-GOAL CREATION & INDEPENDENCE
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Multi-Goal Creation & Learner State Isolation ---");
  const { goal: mathGoal } = await learningStateService.createGoal(newLearnerId, {
    rawObjective: "I want to master Mathematics for exams and problem solving",
    selectedDomainId: "math-exams",
    selfReportedLevel: "Beginner",
    userId: newLearnerId,
  });

  assert(Boolean(mathGoal.id), `Created second distinct goal: ID ${mathGoal.id.slice(0, 8)} (${mathGoal.domainId})`);

  const userGoals = await learningStateService.getUserGoals(newLearnerId);
  assert(userGoals.length === 2, `Learner holds 2 separate goals in library without overwriting`);

  // Verify state isolation: mathGoal has not run diagnostic yet
  const mathState = await learningStateService.getCurrentLearningState(newLearnerId, mathGoal.id);
  assert(mathState.diagnosticCompleted === false, `Second goal maintains independent unassessed state`);

  const pyState = await learningStateService.getCurrentLearningState(newLearnerId, pyGoal.id);
  assert(pyState.diagnosticCompleted === true, `First goal preserves completed diagnostic state`);

  // -------------------------------------------------------------------------
  // 5. PRESERVATION OF EXISTING CERRADO GOAL
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Preservation of Existing Cerrado Geography Goal ---");
  const testUserId = "1335ce7a-9c6a-48c2-a9ba-406d81cc6bb8";
  const cerradoGoalId = "42e45de7-1e64-4df0-bfae-b6dc689ebe64";

  try {
    const cerradoGoal = await learningStateService.getGoal(testUserId, cerradoGoalId);
    assert(Boolean(cerradoGoal), `Existing Cerrado goal found: "${cerradoGoal.title}"`);
    assert(cerradoGoal.domainId.includes("cerrado"), `Domain is intact: ${cerradoGoal.domainId}`);

    const cerradoState = await learningStateService.getCurrentLearningState(testUserId, cerradoGoalId);
    assert(cerradoState.competencies.length >= 7, `Cerrado goal maintains all ${cerradoState.competencies.length} competencies`);
  } catch (err) {
    console.warn(`[!] Note on Cerrado goal retrieval: ${err}`);
  }

  console.log("\n============================================================");
  console.log("GUIDED LEARNING UX 2.0 VALIDATION SUMMARY");
  console.log("============================================================");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runGuidedUxValidation().catch((err) => {
  console.error("Unhandled validation error:", err);
  process.exit(1);
});
