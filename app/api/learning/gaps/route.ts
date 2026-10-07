import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { masteryService } from "@/lib/learning/state/mastery-service";
import { UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goalId");

  if (!goalId) {
    return NextResponse.json({ error: "goalId query parameter is required." }, { status: 400 });
  }

  try {
    const gaps = await masteryService.getGaps(userId, goalId);
    return NextResponse.json({ gaps });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
