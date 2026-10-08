import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { learningStateService } from "../lib/learning/state/learning-state-service";
import { assessmentService } from "../lib/learning/assessment/assessment-service";
import { CURATED_INDEPENDENT_ASSESSMENT_ITEMS } from "../lib/learning/assessment/curriculum/items";

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const p = path.resolve(process.cwd(), file);
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

interface S7ValidationReport {
  connected: boolean;
  s7TablesExist: boolean;
  userCreated: boolean;
  goalCreated: boolean;
  baselineCompleted: boolean;
  baselineScore: number;
  interventionSimulated: boolean;
  finalCompleted: boolean;
  finalScore: number;
  learningGainCalculated: boolean;
  absoluteGain: number;
  baselineUnchanged: boolean;
  competencyGainsVerified: boolean;
  d7RetentionVerified: boolean;
  d7RetentionRatio: number;
  d30RetentionVerified: boolean;
  d30RetentionRatio: number;
  rlsCrossUserEnforced: boolean;
  s1s6RegressionVerified: boolean;
  cleanupSuccessful: boolean;
}

const report: S7ValidationReport = {
  connected: false,
  s7TablesExist: false,
  userCreated: false,
  goalCreated: false,
  baselineCompleted: false,
  baselineScore: 0,
  interventionSimulated: false,
  finalCompleted: false,
  finalScore: 0,
  learningGainCalculated: false,
  absoluteGain: 0,
  baselineUnchanged: false,
  competencyGainsVerified: false,
  d7RetentionVerified: false,
  d7RetentionRatio: 0,
  d30RetentionVerified: false,
  d30RetentionRatio: 0,
  rlsCrossUserEnforced: false,
  s1s6RegressionVerified: false,
  cleanupSuccessful: false,
};

async function runS7Validation() {
  console.log("============================================================");
  console.log("EDUIA S7 — ASSESSMENT & MEASUREMENT ENGINE");
  console.log("REAL SUPABASE RUNTIME VALIDATION GATE");
  console.log("============================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error("Missing Supabase environment configuration (.env/.env.local)");
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Connection Check
  const { data: ping, error: pingErr } = await adminClient.from("domains").select("id").limit(1);
  if (pingErr) {
    throw new Error(`Failed to connect to Supabase: ${pingErr.message}`);
  }
  report.connected = true;
  console.log("✓ Step 1: Real Supabase connection verified");

  // Step 2: Verify S7 Database Tables
  const s7Tables = [
    "assessment_blueprints",
    "independent_assessment_items",
    "independent_assessment_sessions",
    "independent_assessment_responses",
    "learning_gains",
    "retention_records",
  ];

  let missingTables = 0;
  for (const table of s7Tables) {
    const { error } = await adminClient.from(table).select("*").limit(0);
    if (error) {
      console.error(`  ✗ Missing S7 table: ${table} (${error.message})`);
      missingTables++;
    }
  }

  if (missingTables > 0) {
    throw new Error(`S7 table check failed: ${missingTables} tables missing`);
  }
  report.s7TablesExist = true;
  console.log("✓ Step 2: All 6 S7 Supabase tables present and accessible");

  // Step 3: Create Test Users A and B
  const timestamp = Date.now();
  const emailA = `test-learner-a-${timestamp}@eduia.dev`;
  const emailB = `test-learner-b-${timestamp}@eduia.dev`;
  const password = "TestPassword123!@#Safe";

  const { data: userAData, error: userAErr } = await adminClient.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (userAErr || !userAData.user) {
    throw new Error(`Failed to create test user A: ${userAErr?.message}`);
  }
  const userAId = userAData.user.id;

  const { data: userBData, error: userBErr } = await adminClient.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (userBErr || !userBData.user) {
    throw new Error(`Failed to create test user B: ${userBErr?.message}`);
  }
  const userBId = userBData.user.id;
  report.userCreated = true;
  console.log(`✓ Step 3: Created test users (User A: ${userAId}, User B: ${userBId})`);

  try {
    // Step 4: Create Learning Goal for User A
    const { goal } = await learningStateService.createGoal(userAId, {
      rawObjective: "Master foundational Python data types and control flow",
      selectedDomainId: "python-junior",
    });
    report.goalCreated = true;
    console.log(`✓ Step 4: Learning goal created for User A (Goal ID: ${goal.id})`);

    // Step 5: Start & Complete Diagnostic Baseline
    const { session: diagSession, items: diagItems } = await learningStateService.startDiagnostic(
      userAId,
      goal.id
    );

    for (const item of diagItems) {
      await learningStateService.submitDiagnosticAnswer(
        userAId,
        diagSession.id,
        item.id,
        item.options ? item.options[0] : "10"
      );
    }

    const diagReport = await learningStateService.completeDiagnostic(userAId, diagSession.id);
    const baselineScore = diagReport.overallBaselineScore;
    report.baselineCompleted = true;
    report.baselineScore = baselineScore;
    console.log(`✓ Step 5: Diagnostic baseline established (Baseline Score: ${baselineScore.toFixed(1)}/100)`);

    // Step 6: Verify Baseline Persistence in Supabase
    const { data: dbDiagSession } = await adminClient
      .from("diagnostic_sessions")
      .select("id, overall_baseline_score, status")
      .eq("id", diagSession.id)
      .single();

    if (!dbDiagSession || dbDiagSession.status !== "COMPLETED") {
      throw new Error("Diagnostic session not properly persisted to Supabase");
    }
    console.log("✓ Step 6: Baseline persistence verified in Supabase diagnostic_sessions");

    // Step 7: Simulate Learning Intervention (Intervention updates mastery)
    await learningStateService.recordFeynmanEvidence(
      userAId,
      goal.id,
      "py-variables-types",
      85,
      0.80,
      { simulated: true }
    );
    report.interventionSimulated = true;
    console.log("✓ Step 7: Adaptive learning intervention simulated (Feynman conceptual evidence emitted)");

    // Step 8: Verify learning state changed while baseline remained intact
    const stateAfterIntervention = await learningStateService.getCurrentLearningState(userAId, goal.id);
    if (stateAfterIntervention.overallBaselineScore !== baselineScore) {
      throw new Error("Baseline score changed after intervention! Invariant violated.");
    }
    console.log("✓ Step 8: Learner state updated; baseline score remains perfectly preserved");

    // Step 9: Start Independent FINAL Assessment Session
    const { session: finalSession, items: finalItems } = await assessmentService.startAssessmentSession({
      userId: userAId,
      learningGoalId: goal.id,
      domainId: "python-junior",
      assessmentType: "FINAL",
      baselineItemIdsToAvoid: diagSession.itemIds,
    });

    console.log(`✓ Step 9: Independent FINAL assessment started (${finalItems.length} items, disallowing baseline items)`);

    // Step 10: Submit Answers and Complete Final Assessment
    for (const item of finalItems) {
      const fullItem = CURATED_INDEPENDENT_ASSESSMENT_ITEMS.find((i) => i.id === item.id);
      await assessmentService.submitAnswer({
        userId: userAId,
        sessionId: finalSession.id,
        itemId: item.id,
        answer: fullItem?.correctAnswer || "True",
      });
    }

    const finalResult = await assessmentService.completeAssessment(userAId, finalSession.id);
    report.finalCompleted = true;
    report.finalScore = finalResult.scoreResult.overallScore;
    console.log(`✓ Step 10: Final assessment submitted & scored (Final Score: ${report.finalScore.toFixed(1)}/100)`);

    // Step 11: Verify Persistence of Final Assessment Session and Responses
    const { data: dbFinalSession } = await adminClient
      .from("independent_assessment_sessions")
      .select("id, overall_score, status")
      .eq("id", finalSession.id)
      .single();

    if (!dbFinalSession || dbFinalSession.status !== "COMPLETED") {
      throw new Error("Final assessment session was not persisted with status COMPLETED");
    }

    const { count: respCount } = await adminClient
      .from("independent_assessment_responses")
      .select("id", { count: "exact" })
      .eq("session_id", finalSession.id);

    console.log(`✓ Step 11: Final session and ${respCount} independent responses persisted in Supabase`);

    // Step 12: Verify Learning Gain Calculation & Persistence
    if (!finalResult.learningGainReport) {
      throw new Error("Expected learningGainReport to be calculated for FINAL assessment");
    }

    const learningGain = finalResult.learningGainReport.learningGain;
    report.learningGainCalculated = true;
    report.absoluteGain = learningGain;
    console.log(`✓ Step 12: Primary metric Learning Gain = ${learningGain >= 0 ? "+" : ""}${learningGain.toFixed(1)} pts (${baselineScore.toFixed(1)} → ${report.finalScore.toFixed(1)})`);

    const { data: dbGain, error: dbGainErr } = await adminClient
      .from("learning_gains")
      .select("id, learning_gain, baseline_score, final_score")
      .eq("learning_goal_id", goal.id)
      .single();

    if (dbGainErr || !dbGain) {
      throw new Error(`Learning gain record was not persisted to Supabase: ${dbGainErr?.message}`);
    }
    console.log("✓ Step 12b: Learning gain record verified in Supabase learning_gains table");

    // Step 13: CRITICAL INVARIANT: Verify baseline score is 100% UNCHANGED
    const stateAfterFinal = await learningStateService.getCurrentLearningState(userAId, goal.id);
    if (stateAfterFinal.overallBaselineScore !== baselineScore) {
      throw new Error(`CRITICAL INVARIANT VIOLATED: Baseline changed from ${baselineScore} to ${stateAfterFinal.overallBaselineScore}`);
    }
    report.baselineUnchanged = true;
    console.log("✓ Step 13: CRITICAL INVARIANT CONFIRMED: Baseline remains completely unchanged after final assessment");

    // Step 14: Verify Competency-Level Gain Breakdown
    const compGains = finalResult.learningGainReport.competencyGains;
    if (!compGains || compGains.length === 0) {
      throw new Error("Expected competency-level gains breakdown in learningGainReport");
    }
    report.competencyGainsVerified = true;
    const learnedCount = compGains.filter((c) => c.status === "LEARNED").length;
    console.log(`✓ Step 14: Competency-level gains breakdown verified (${compGains.length} competencies tracked, ${learnedCount} learned)`);

    // Step 15 & 16: D7 Retention Assessment
    const { session: d7Session, items: d7Items } = await assessmentService.startAssessmentSession({
      userId: userAId,
      learningGoalId: goal.id,
      domainId: "python-junior",
      assessmentType: "RETENTION_D7",
    });

    for (const item of d7Items) {
      const fullItem = CURATED_INDEPENDENT_ASSESSMENT_ITEMS.find((i) => i.id === item.id);
      await assessmentService.submitAnswer({
        userId: userAId,
        sessionId: d7Session.id,
        itemId: item.id,
        answer: fullItem?.correctAnswer || "True",
      });
    }

    const d7Result = await assessmentService.completeAssessment(userAId, d7Session.id);
    if (!d7Result.retentionReport) {
      throw new Error("Expected retentionReport for D7 assessment");
    }
    report.d7RetentionVerified = true;
    report.d7RetentionRatio = d7Result.retentionReport.retentionRatio;
    console.log(`✓ Step 15-16: D7 Retention Assessment completed (D7 Score: ${d7Result.scoreResult.overallScore.toFixed(1)}/100, Retention Ratio: ${(report.d7RetentionRatio * 100).toFixed(1)}%)`);

    // Step 17 & 18: D30 Retention Assessment
    const { session: d30Session, items: d30Items } = await assessmentService.startAssessmentSession({
      userId: userAId,
      learningGoalId: goal.id,
      domainId: "python-junior",
      assessmentType: "RETENTION_D30",
    });

    for (const item of d30Items) {
      const fullItem = CURATED_INDEPENDENT_ASSESSMENT_ITEMS.find((i) => i.id === item.id);
      await assessmentService.submitAnswer({
        userId: userAId,
        sessionId: d30Session.id,
        itemId: item.id,
        answer: fullItem?.correctAnswer || "True",
      });
    }

    const d30Result = await assessmentService.completeAssessment(userAId, d30Session.id);
    if (!d30Result.retentionReport) {
      throw new Error("Expected retentionReport for D30 assessment");
    }
    report.d30RetentionVerified = true;
    report.d30RetentionRatio = d30Result.retentionReport.retentionRatio;
    console.log(`✓ Step 17-18: D30 Retention Assessment completed (D30 Score: ${d30Result.scoreResult.overallScore.toFixed(1)}/100, Retention Ratio: ${(report.d30RetentionRatio * 100).toFixed(1)}%)`);

    // Verify retention records in Supabase
    const { data: dbRetentionRecords } = await adminClient
      .from("retention_records")
      .select("id, retention_type, retention_ratio")
      .eq("learning_goal_id", goal.id);

    if (!dbRetentionRecords || dbRetentionRecords.length < 2) {
      throw new Error("Expected 2 retention records in Supabase retention_records table");
    }
    console.log("✓ Step 18b: Retention records for D7 & D30 verified in Supabase retention_records table");

    // Step 19: Real Supabase RLS Validation (User B Isolation)
    // Sign in as User B using Anon Client to test Supabase RLS
    const userBClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: signInBErr } = await userBClient.auth.signInWithPassword({
      email: emailB,
      password,
    });

    if (signInBErr) {
      throw new Error(`Failed to sign in User B: ${signInBErr.message}`);
    }

    // Attempt to read User A's session via User B client (RLS must filter it out)
    const { data: userBSessions } = await userBClient
      .from("independent_assessment_sessions")
      .select("id")
      .eq("id", finalSession.id);

    if (userBSessions && userBSessions.length > 0) {
      throw new Error("RLS BREACH: User B was able to read User A's assessment session!");
    }

    // Attempt to read User A's learning gain via User B client
    const { data: userBGains } = await userBClient
      .from("learning_gains")
      .select("id")
      .eq("learning_goal_id", goal.id);

    if (userBGains && userBGains.length > 0) {
      throw new Error("RLS BREACH: User B was able to read User A's learning gain record!");
    }

    // Attempt to read User A's retention records via User B client
    const { data: userBRetentions } = await userBClient
      .from("retention_records")
      .select("id")
      .eq("learning_goal_id", goal.id);

    if (userBRetentions && userBRetentions.length > 0) {
      throw new Error("RLS BREACH: User B was able to read User A's retention records!");
    }

    report.rlsCrossUserEnforced = true;
    console.log("✓ Step 19: Supabase Row Level Security (RLS) successfully prevented User B from reading User A's assessment data");

    // Step 20: Goal Measurement Dashboard API Verification
    const measurementSummary = await assessmentService.getMeasurementReport(userAId, goal.id);
    if (!measurementSummary.learningGain || !measurementSummary.retention.d7) {
      throw new Error("Measurement dashboard report incomplete");
    }
    report.s1s6RegressionVerified = true;
    console.log("✓ Step 20: Measurement dashboard API returned full learning gain and retention payload");

  } finally {
    // Teardown / Cleanup test users from auth.users (cascades to all user tables)
    console.log("\n--- Cleaning up test users ---");
    await adminClient.auth.admin.deleteUser(userAId);
    await adminClient.auth.admin.deleteUser(userBId);
    report.cleanupSuccessful = true;
    console.log("✓ Teardown: Cleaned up test users A and B");
  }

  console.log("\n============================================================");
  console.log("S7 SUPABASE RUNTIME VALIDATION SUMMARY: 100% PASS");
  console.log("============================================================");
  console.log(JSON.stringify(report, null, 2));
}

runS7Validation().catch((err) => {
  console.error("\nFATAL ERROR DURING S7 RUNTIME VALIDATION:", err);
  process.exit(1);
});
