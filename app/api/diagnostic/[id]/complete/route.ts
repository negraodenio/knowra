import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { productEventService } from "@/lib/observability/product-events";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await context.params;

  try {
    const report = await learningStateService.completeDiagnostic(userId, sessionId);

    productEventService.recordEvent(
      userId,
      "diagnostic_completed",
      {
        sessionId,
        goalId: report.learningGoalId,
        domainId: report.domainId,
        overallBaselineScore: report.overallBaselineScore,
        relativeStrengths: report.relativeStrengths,
        lowerBaselines: report.lowerBaselines,
      },
      report.learningGoalId,
      report.domainId
    );

    return NextResponse.json(report);
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
