import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { assessmentService } from "@/lib/learning/assessment/assessment-service";
import { productEventService } from "@/lib/observability/product-events";
import { z } from "zod";

const CompleteAssessmentSchema = z.object({
  userId: z.string().min(1).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const authUserId = await getAuthenticatedUserId(req);
    const body = await req.json().catch(() => ({}));
    const parsed = CompleteAssessmentSchema.safeParse(body);

    const effectiveUserId = parsed.success && parsed.data.userId ? parsed.data.userId : authUserId;

    if (!effectiveUserId) {
      return NextResponse.json({ error: "Unauthorized: userId is required." }, { status: 401 });
    }

    const result = await assessmentService.completeAssessment(effectiveUserId, sessionId);

    productEventService.recordEvent(
      effectiveUserId,
      "assessment_completed",
      {
        sessionId,
        score: result.scoreResult.overallScore,
        passed: result.scoreResult.overallScore >= 70,
        assessmentType: result.session.assessmentType,
      },
      result.session.learningGoalId,
      result.session.domainId
    );

    if (result.learningGainReport) {
      productEventService.recordEvent(
        effectiveUserId,
        "learning_gain_recorded",
        {
          learningGain: result.learningGainReport.learningGain,
          relativeGain: result.learningGainReport.relativeGain,
          baselineScore: result.learningGainReport.baselineScore,
          finalScore: result.learningGainReport.finalScore,
        },
        result.session.learningGoalId,
        result.session.domainId
      );
    }

    if (result.retentionReport) {
      productEventService.recordEvent(
        effectiveUserId,
        "retention_recorded",
        {
          retentionType: result.retentionReport.retentionType,
          retentionScore: result.retentionReport.retentionScore,
          gainRetained: result.retentionReport.gainRetained,
        },
        result.session.learningGoalId,
        result.session.domainId
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") || message.includes("unauthorized") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
