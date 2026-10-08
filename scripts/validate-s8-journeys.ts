/**
 * KNOWRA — S8.1 THREE-JOURNEY PRODUCT REALITY & PEDAGOGICAL VALIDATION SCRIPT
 *
 * Validates the complete learner loop across all three curated domains:
 * 1. Journey A: Python Junior ("I want to become proficient in Python programming.")
 * 2. Journey B: Mathematics ("I want to prepare for my mathematics exam.")
 * 3. Journey C: Excel Pro ("I want to become proficient in Excel.")
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";
import { learningStateService } from "../lib/learning/state/learning-state-service";
import { recommendationService } from "../lib/learning/state/recommendation-service";
import { masteryService } from "../lib/learning/state/mastery-service";
import { assessmentService } from "../lib/learning/assessment/assessment-service";
import { getCuratedCompetenciesByDomain } from "../lib/learning/curriculum";
import { getPracticeActivity } from "../lib/learning/activities/curriculum-activities";
import { productEventService } from "../lib/observability/product-events";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

interface JourneyConfig {
  name: string;
  domainId: string;
  rawObjective: string;
  expectedMinCompetencies: number;
}

const JOURNEYS: JourneyConfig[] = [
  {
    name: "Journey A: Python Junior",
    domainId: "python-junior",
    rawObjective: "I want to become proficient in Python programming.",
    expectedMinCompetencies: 7,
  },
  {
    name: "Journey B: Mathematics for Exams",
    domainId: "math-exams",
    rawObjective: "I want to prepare for my mathematics exam.",
    expectedMinCompetencies: 5,
  },
  {
    name: "Journey C: Excel Pro",
    domainId: "excel-pro",
    rawObjective: "I want to become proficient in Excel.",
    expectedMinCompetencies: 5,
  },
];

interface GateResult {
  step: string;
  passed: boolean;
  details: string;
}

const allResults: Record<string, GateResult[]> = {};

async function runJourney(journey: JourneyConfig) {
  console.log(`\n============================================================`);
  console.log(`VALIDATING: ${journey.name} [Domain: ${journey.domainId}]`);
  console.log(`============================================================`);

  const results: GateResult[] = [];
  function record(step: string, passed: boolean, details: string) {
    results.push({ step, passed, details });
    const mark = passed ? "[✓ PASS]" : "[✗ FAIL]";
    console.log(`${mark} ${step}: ${details}`);
  }

  // 1. Create unique test learner
  const testEmail = `s81-learner-${journey.domainId}-${Date.now()}@knowra.test`;
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    throw new Error(`Failed to create test user: ${authErr?.message}`);
  }
  const userId = authData.user.id;

  try {
    // 2. Goal Creation & Domain Normalization
    const { goal, profile } = await learningStateService.createGoal(userId, {
      rawObjective: journey.rawObjective,
      selectedDomainId: journey.domainId,
      selfReportedLevel: "Beginner",
    });

    record(
      "Goal & Domain Mapping",
      goal.domainId === journey.domainId && Boolean(goal.id && profile.activeGoalId === goal.id),
      `Goal ID: ${goal.id.slice(0, 8)} | Target: "${goal.title}" | Domain: ${goal.domainId}`
    );

    // Record goal event
    productEventService.recordEvent(
      userId,
      "goal_created",
      { goalId: goal.id, title: goal.title },
      goal.id,
      journey.domainId
    );

    // 3. Start Diagnostic Assessment
    const { session: diagSession, items: diagItems } =
      await learningStateService.startDiagnostic(userId, goal.id);

    productEventService.recordEvent(
      userId,
      "diagnostic_started",
      { sessionId: diagSession.id },
      goal.id,
      journey.domainId
    );

    record(
      "Diagnostic Session Started",
      Boolean(diagSession.id && diagItems.length > 0),
      `Session ID: ${diagSession.id.slice(0, 8)} | Curated Items: ${diagItems.length}`
    );

    // 4. Answer and Complete Diagnostic
    for (let i = 0; i < diagItems.length; i++) {
      const item = diagItems[i];
      // Alternate correct and incorrect to create an initial competency spread
      const ans = i % 2 === 0 ? item.correctAnswer : "non_matching_answer";
      await learningStateService.submitDiagnosticAnswer(userId, diagSession.id, item.id, ans);
    }

    const diagReport = await learningStateService.completeDiagnostic(userId, diagSession.id);

    productEventService.recordEvent(
      userId,
      "diagnostic_completed",
      { overallBaselineScore: diagReport.overallBaselineScore },
      goal.id,
      journey.domainId
    );

    record(
      "Diagnostic Completed & Starting Point",
      diagReport.overallBaselineScore > 0,
      `Baseline: ${diagReport.overallBaselineScore.toFixed(1)}% | Strengths: ${diagReport.relativeStrengths.length} | Focus: ${diagReport.lowerBaselines.length}`
    );

    // 5. Inspect Learning Map State
    const comps = getCuratedCompetenciesByDomain(journey.domainId);
    const state = await learningStateService.getCurrentLearningState(userId, goal.id);

    record(
      "Learning Map Competency Coverage",
      state.competencies.length >= journey.expectedMinCompetencies,
      `State Competencies: ${state.competencies.length} (Expected >= ${journey.expectedMinCompetencies})`
    );

    // 6. Inspect Next Best Action (NBA)
    const rec1 = await recommendationService.getNextBestAction(userId, goal.id);

    record(
      "Next Best Action Evaluated",
      Boolean(rec1 && rec1.action && rec1.competencyId),
      `Action: [${rec1?.action}] on '${rec1?.competencyId}' | Priority: ${rec1?.priority} | Reason: "${rec1?.reason.slice(0, 50)}..."`
    );

    // 7. Inspect Activity Content Quality
    const targetCompId = rec1?.competencyId || comps[0].id;
    const activity = getPracticeActivity(targetCompId);

    record(
      "Contextual Activity Available",
      Boolean(activity && activity.instruction && activity.practice),
      `Title: "${activity?.title || targetCompId}" | Category: ${activity?.category || "PROCEDURAL"}`
    );

    // 8. Execute Practice & Emit Genuine Evidence
    await recommendationService.acceptRecommendation(userId, rec1.id);

    const evidenceRecord = await learningStateService.recordPracticeEvidence(
      userId,
      goal.id,
      targetCompId,
      95,
      0.9,
      { source: "journey-validation", activityTitle: activity?.title }
    );

    productEventService.recordEvent(
      userId,
      "evidence_emitted",
      { evidenceId: evidenceRecord.id, score: 95 },
      goal.id,
      journey.domainId
    );

    record(
      "Evidence Emitted to Ledger",
      Boolean(evidenceRecord.id && evidenceRecord.score === 95),
      `Evidence ID: ${evidenceRecord.id?.slice(0, 8)} | Type: ${evidenceRecord.evidenceType} | Result: ${evidenceRecord.result}`
    );

    // Complete recommendation
    await recommendationService.completeRecommendation(userId, rec1.id);

    // 9. Recalculate Mastery Server-Side
    const { masteryOutput, snapshot } = await masteryService.recalculateCompetencyMastery(
      userId,
      goal.id,
      targetCompId,
      "JOURNEY_ACTIVITY_COMPLETED"
    );

    productEventService.recordEvent(
      userId,
      "mastery_changed",
      { competencyId: targetCompId, masteryScore: masteryOutput.masteryScore },
      goal.id,
      journey.domainId
    );

    record(
      "Mastery Shift & Snapshot Created",
      masteryOutput.masteryScore > 0 && Boolean(snapshot.id),
      `Mastery: ${masteryOutput.masteryScore.toFixed(0)}% (${masteryOutput.masteryState}) | Snapshot: ${snapshot.id.slice(0, 8)}`
    );

    // 10. Refresh Next Best Action
    const rec2 = await recommendationService.getNextBestAction(userId, goal.id);

    record(
      "Recommendation Refresh Loop",
      Boolean(rec2 && rec2.id),
      `New NBA: [${rec2?.action}] on '${rec2?.competencyId}'`
    );

    // 11. Learning History Audit Trail
    const events = productEventService.getUserEvents(userId);

    record(
      "Audit Trail & Telemetry",
      events.length > 0,
      `Recorded Product Events: ${events.length} (Latest: ${events[0]?.eventType})`
    );

    // 12. Final Assessment Availability
    const { session: finalSession, items: finalItems } =
      await assessmentService.startAssessmentSession({
        userId,
        learningGoalId: goal.id,
        domainId: journey.domainId,
        assessmentType: "FINAL",
        baselineItemIdsToAvoid: diagSession.itemIds,
      });

    record(
      "Independent Assessment Flow",
      Boolean(finalSession.id && finalItems.length > 0),
      `Session ID: ${finalSession.id.slice(0, 8)} | Non-overlapping Items: ${finalItems.length}`
    );
  } finally {
    // Cleanup test user
    await supabase.auth.admin.deleteUser(userId);
  }

  allResults[journey.name] = results;
}

async function main() {
  console.log(`\n============================================================`);
  console.log(`KNOWRA — S8.1 THREE-JOURNEY REALITY VALIDATION`);
  console.log(`============================================================`);

  for (const journey of JOURNEYS) {
    await runJourney(journey);
  }

  console.log(`\n============================================================`);
  console.log(`THREE-JOURNEY SUMMARY MATRIX`);
  console.log(`============================================================`);

  let totalGates = 0;
  let totalPassed = 0;

  for (const [journeyName, results] of Object.entries(allResults)) {
    console.log(`\n${journeyName}:`);
    for (const r of results) {
      totalGates++;
      if (r.passed) totalPassed++;
      const mark = r.passed ? "  ✓" : "  ✗";
      console.log(`${mark} ${r.step}`);
    }
  }

  console.log(`\n------------------------------------------------------------`);
  console.log(`Total Gates Across 3 Journeys: ${totalGates}`);
  console.log(`Passed:                        ${totalPassed}`);
  console.log(`Failed:                        ${totalGates - totalPassed}`);
  console.log(`Success Rate:                  ${((totalPassed / totalGates) * 100).toFixed(1)}%`);
  console.log(`============================================================\n`);

  if (totalPassed < totalGates) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Three-journey validation failed:", err);
  process.exit(1);
});
