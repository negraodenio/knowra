import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { productEventService } from "@/lib/observability/product-events";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goalId") || undefined;

  try {
    if (goalId) {
      await learningStateService.getGoal(userId, goalId);
    }

    const events = productEventService.getUserEvents(userId, goalId);
    const evidence = await learningStateService.getAllEvidence(userId, goalId);

    // Ensure timeline displays verified evidence from database even across server restarts
    const eventEvidenceIds = new Set<string>(
      events.map((e) => {
        const payload = e.payload as Record<string, unknown> | undefined;
        return typeof payload?.evidenceId === "string" ? payload.evidenceId : e.id;
      })
    );
    const synthesizedEvents = evidence
      .filter((ev) => ev.id && !eventEvidenceIds.has(ev.id))
      .map((ev, idx) => ({
        id: ev.id || `evidence-${idx}`,
        seq: -(idx + 1),
        userId: ev.learnerId,
        goalId: (ev.metadata as Record<string, unknown>)?.goalId as string | undefined,
        eventType: (
          ev.evidenceType === "DIAGNOSTIC"
            ? "diagnostic_completed"
            : ev.evidenceType === "FINAL_ASSESSMENT"
            ? "assessment_completed"
            : "activity_completed"
        ) as unknown as import("@/lib/observability/product-events").ProductEventType,
        payload: {
          competencyId: ev.competencyId,
          score: ev.score,
          result: ev.result,
          confidence: ev.confidence,
          evidenceType: ev.evidenceType,
        },
        timestamp: ev.timestamp,
      }));

    const combinedEvents = [...events, ...synthesizedEvents].sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );

    return NextResponse.json({
      events: combinedEvents,
      evidence,
      totalEvidenceCount: evidence.length,
    });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
