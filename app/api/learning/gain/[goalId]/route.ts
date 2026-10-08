import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { assessmentService } from "@/lib/learning/assessment/assessment-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const authUserId = await getAuthenticatedUserId(req);
    const url = new URL(req.url);
    const userId = authUserId || url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId parameter is required." }, { status: 400 });
    }

    const report = await assessmentService.getMeasurementReport(userId, goalId);
    return NextResponse.json(report, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") || message.includes("unauthorized") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
