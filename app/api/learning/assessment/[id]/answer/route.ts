import { NextRequest, NextResponse } from "next/server";
import { assessmentService } from "@/lib/learning/assessment/assessment-service";
import { z } from "zod";

const SubmitAnswerSchema = z.object({
  userId: z.string().uuid(),
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
    const body = await req.json();
    const parsed = SubmitAnswerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await assessmentService.submitAnswer({
      sessionId,
      ...parsed.data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") || message.includes("unauthorized") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
