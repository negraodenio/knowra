import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { reviewService } from "@/lib/learning/state/review-service";
import { UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goalId");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!goalId) {
    return NextResponse.json({ error: "goalId query parameter is required." }, { status: 400 });
  }

  try {
    const queue = await reviewService.getReviewQueue(userId, goalId, limit);
    return NextResponse.json({ queue, count: queue.length });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
