import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { feynmanService } from "@/lib/learning/state/feynman-service";
import { UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ competencyId: string }> }
) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await params; // Consume params

  try {
    const body = await req.json();
    const { sessionId, explanation } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }
    if (!explanation) {
      return NextResponse.json({ error: "explanation text is required." }, { status: 400 });
    }

    const result = await feynmanService.submitExplanation(userId, sessionId, explanation);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, session: result.session },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      session: result.session,
      masteryOutput: result.masteryOutput,
    });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
