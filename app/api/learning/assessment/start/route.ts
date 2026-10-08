import { NextRequest, NextResponse } from "next/server";
import { assessmentService } from "@/lib/learning/assessment/assessment-service";
import { z } from "zod";

const StartAssessmentSchema = z.object({
  userId: z.string().uuid(),
  learningGoalId: z.string().uuid(),
  domainId: z.string(),
  assessmentType: z.enum(["BASELINE", "FINAL", "RETENTION_D7", "RETENTION_D30"]),
  blueprintId: z.string().optional(),
  baselineItemIdsToAvoid: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = StartAssessmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await assessmentService.startAssessmentSession(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") || message.includes("unauthorized") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
