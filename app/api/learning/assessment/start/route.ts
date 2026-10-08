import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { assessmentService } from "@/lib/learning/assessment/assessment-service";
import { productEventService } from "@/lib/observability/product-events";
import { z } from "zod";

const StartAssessmentSchema = z.object({
  userId: z.string().min(1).optional(),
  learningGoalId: z.string().min(1),
  domainId: z.string(),
  assessmentType: z.enum(["BASELINE", "FINAL", "RETENTION_D7", "RETENTION_D30"]),
  blueprintId: z.string().optional(),
  baselineItemIdsToAvoid: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authUserId = await getAuthenticatedUserId(req);
    const body = await req.json();

    const effectiveUserId = body.userId || authUserId;
    if (!effectiveUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = StartAssessmentSchema.safeParse({
      ...body,
      userId: effectiveUserId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await assessmentService.startAssessmentSession({
      ...parsed.data,
      userId: effectiveUserId,
    });

    productEventService.recordEvent(
      effectiveUserId,
      "assessment_started",
      {
        sessionId: result.session.id,
        assessmentType: parsed.data.assessmentType,
        domainId: parsed.data.domainId,
        itemCount: result.items.length,
      },
      parsed.data.learningGoalId,
      parsed.data.domainId
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") || message.includes("unauthorized") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
