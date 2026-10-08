import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { productEventService } from "@/lib/observability/product-events";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goalId");

  try {
    if (goalId) {
      const goal = await learningStateService.getGoal(userId, goalId);
      return NextResponse.json({ goal });
    }

    const goals = await learningStateService.getUserGoals(userId);
    const activeGoalData = await learningStateService.getActiveGoal(userId);

    return NextResponse.json({
      goals,
      activeGoal: activeGoalData?.goal || null,
      profile: activeGoalData?.profile || null,
    });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rawObjective, selectedDomainId, targetOutcome, selfReportedLevel, deadline } = body;

    if (!rawObjective || !selectedDomainId) {
      return NextResponse.json(
        { error: "rawObjective and selectedDomainId are required." },
        { status: 400 }
      );
    }

    const result = await learningStateService.createGoal(userId, {
      rawObjective,
      selectedDomainId,
      targetOutcome,
      selfReportedLevel,
      deadline,
      userId,
    });

    productEventService.recordEvent(
      userId,
      "goal_created",
      {
        goalId: result.goal.id,
        domainId: result.goal.domainId,
        rawObjective,
        targetOutcome: result.goal.targetOutcome,
        selfReportedLevel,
      },
      result.goal.id,
      result.goal.domainId
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { activeGoalId } = body;

    if (!activeGoalId) {
      return NextResponse.json({ error: "activeGoalId is required." }, { status: 400 });
    }

    const profile = await learningStateService.setActiveGoal(userId, activeGoalId);

    productEventService.recordEvent(
      userId,
      "goal_updated",
      { activeGoalId },
      activeGoalId,
      profile.domainId
    );

    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
