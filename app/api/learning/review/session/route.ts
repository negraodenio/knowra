import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { reviewService } from "@/lib/learning/state/review-service";
import { UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { goalId, limit } = body;

    if (!goalId) {
      return NextResponse.json({ error: "goalId is required in request body." }, { status: 400 });
    }

    const session = await reviewService.startReviewSession(userId, goalId, limit || 10);
    return NextResponse.json({ session });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
