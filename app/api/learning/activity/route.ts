import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { getCompetencyById } from "@/lib/learning/curriculum";
import { getPracticeActivity } from "@/lib/learning/activities/curriculum-activities";
import { productEventService } from "@/lib/observability/product-events";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goalId");
  const competencyId = searchParams.get("competencyId");
  const action = searchParams.get("action") || "PRACTICE";

  if (!goalId || !competencyId) {
    return NextResponse.json(
      { error: "goalId and competencyId query parameters are required." },
      { status: 400 }
    );
  }

  try {
    // Validate goal ownership
    await learningStateService.getGoal(userId, goalId);

    const comp = getCompetencyById(competencyId);
    if (!comp) {
      return NextResponse.json(
        { error: `Competency '${competencyId}' not found.` },
        { status: 404 }
      );
    }

    const curated = getPracticeActivity(competencyId);

    const activity = curated || {
      competencyId: comp.id,
      domainId: comp.domainId,
      title: comp.title,
      category: comp.category,
      objective: `Demonstrate mastery in ${comp.title}`,
      instruction: comp.description,
      keyConcepts: [
        `Understand core principles of ${comp.title}`,
        "Apply systematic problem-solving methods",
        "Avoid common edge-case errors",
      ],
      practice: {
        id: `gen-prac-${comp.id}`,
        prompt: `Explain and demonstrate the fundamental rules of ${comp.title}.`,
        itemType: "TEXT",
        correctAnswer: "A comprehensive explanation demonstrating understanding",
        explanation: "Mastery requires clear conceptual clarity and procedural precision.",
        hints: ["Review the competency description."],
      },
    };

    productEventService.recordEvent(
      userId,
      "activity_started",
      {
        competencyId,
        action,
        activityTitle: activity.title,
      },
      goalId,
      comp.domainId
    );

    return NextResponse.json({ activity, action });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
