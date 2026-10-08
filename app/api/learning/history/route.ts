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
  const goalId = searchParams.get("goalId") || undefined;

  try {
    if (goalId) {
      await learningStateService.getGoal(userId, goalId);
    }

    const events = productEventService.getUserEvents(userId, goalId);
    const evidence = await learningStateService.getAllEvidence(userId, goalId);

    return NextResponse.json({
      events,
      evidence,
      totalEvidenceCount: evidence.length,
    });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
