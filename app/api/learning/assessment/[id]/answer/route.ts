import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { assessmentService } from "@/lib/learning/assessment/assessment-service";
import { z } from "zod";

const SubmitAnswerSchema = z.object({
  userId: z.string().min(1).optional(),
  itemId: z.string(),
  answer: z.string(),
  responseTimeMs: z.number().int().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const authUserId = await getAuthenticatedUserId(req);
    const body = await req.json();

    const effectiveUserId = body.userId || authUserId;
    if (!effectiveUserId) {
      return NextResponse.json({ error: "Unauthorized: userId is required." }, { status: 401 });
    }

    const parsed = SubmitAnswerSchema.safeParse({
      ...body,
      userId: effectiveUserId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await assessmentService.submitAnswer({
      sessionId,
      userId: effectiveUserId,
      itemId: parsed.data.itemId,
      answer: parsed.data.answer,
      responseTimeMs: parsed.data.responseTimeMs,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") || message.includes("unauthorized") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
