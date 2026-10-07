import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { masteryService } from "@/lib/learning/state/mastery-service";
import { UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { goalId, competencyId } = body;

    if (!goalId) {
      return NextResponse.json({ error: "goalId is required." }, { status: 400 });
    }

    if (competencyId) {
      const result = await masteryService.recalculateCompetencyMastery(
        userId,
        goalId,
        competencyId,
        "API_TRIGGERED_RECALCULATION"
      );
      return NextResponse.json(result);
    } else {
      const results = await masteryService.recalculateGoalMastery(userId, goalId);
      return NextResponse.json({ results });
    }
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
