import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { learningStateService } from "@/lib/learning/state/learning-state-service";

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rawObjective, selectedDomainId, targetOutcome, selfReportedLevel, deadline } = body;

    if (!rawObjective || !selectedDomainId) {
      return NextResponse.json(
        { error: "rawObjective and selectedDomainId are required." },
        { status: 400 }
      );
    }

    const result = await learningStateService.createGoal(userId, {
      rawObjective,
      selectedDomainId,
      targetOutcome,
      selfReportedLevel,
      deadline,
      userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
