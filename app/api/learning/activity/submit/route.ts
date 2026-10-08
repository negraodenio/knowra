import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { masteryService } from "@/lib/learning/state/mastery-service";
import { recommendationService } from "@/lib/learning/state/recommendation-service";
import { productEventService } from "@/lib/observability/product-events";

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      goalId,
      competencyId,
      action = "PRACTICE",
      score,
      response,
      recommendationId,
      metadata = {},
    } = body;

    if (!goalId || !competencyId) {
      return NextResponse.json(
        { error: "goalId and competencyId are required." },
        { status: 400 }
      );
    }

    if (typeof score !== "number" || score < 0 || score > 100) {
      return NextResponse.json(
        { error: "score must be a number between 0 and 100." },
        { status: 400 }
      );
    }

    // 1. Verify goal ownership
    const goal = await learningStateService.getGoal(userId, goalId);

    // 2. Record authentic evidence through Learning Engine (§14, §15)
    const confidence = action === "LEARN" ? 0.75 : action === "PRACTICE" ? 0.85 : 0.80;
    const evidence = await learningStateService.recordPracticeEvidence(
      userId,
      goalId,
      competencyId,
      score,
      confidence,
      {
        ...metadata,
        action,
        userResponse: response,
      }
    );

    productEventService.recordEvent(
      userId,
      "evidence_emitted",
      {
        evidenceId: evidence.id,
        competencyId,
        score,
        result: evidence.result,
        confidence: evidence.confidence,
        action,
      },
      goalId,
      goal.domainId
    );

    // 3. Recalculate Mastery & Evaluate Gaps deterministically (§12, §19, §21)
    const { masteryOutput, gap, snapshot } = await masteryService.recalculateCompetencyMastery(
      userId,
      goalId,
      competencyId,
      `ACTIVITY_${action}_COMPLETED`
    );

    productEventService.recordEvent(
      userId,
      "mastery_changed",
      {
        competencyId,
        masteryScore: masteryOutput.masteryScore,
        masteryState: masteryOutput.masteryState,
        confidenceScore: masteryOutput.confidenceScore,
        gapState: gap ? gap.status : "NONE",
      },
      goalId,
      goal.domainId
    );

    if (gap && gap.status === "OPEN") {
      productEventService.recordEvent(
        userId,
        "gap_detected",
        {
          competencyId,
          severity: gap.severity,
          reason: gap.reason,
        },
        goalId,
        goal.domainId
      );
    }

    // 4. If recommendationId was passed, mark recommendation COMPLETED (§29)
    if (recommendationId) {
      try {
        await recommendationService.completeRecommendation(userId, recommendationId);
      } catch {
        // If recommendation was already completed or expired, proceed
      }
    }

    productEventService.recordEvent(
      userId,
      "activity_completed",
      {
        competencyId,
        action,
        score,
        masteryScore: masteryOutput.masteryScore,
      },
      goalId,
      goal.domainId
    );

    // 5. Evaluate refreshed Next Best Action (§33)
    const nextRecommendation = await recommendationService.getNextBestAction(userId, goalId);

    return NextResponse.json({
      success: true,
      evidence,
      masteryOutput,
      gap,
      snapshot,
      nextRecommendation,
    });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
