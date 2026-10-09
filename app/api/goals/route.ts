import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { productEventService } from "@/lib/observability/product-events";

import { aiCurriculumService } from "@/lib/learning/curriculum/ai-curriculum-service";
import { getDomain } from "@/lib/learning/domains";
import { getCuratedCompetenciesByDomain } from "@/lib/learning/curriculum/index";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goalId");

  try {
    if (goalId) {
      const goal = await learningStateService.getGoal(userId, goalId);
      const domain = getDomain(goal.domainId);
      const domainComps = getCuratedCompetenciesByDomain(goal.domainId);
      const preview = domain ? {
        domainId: domain.id,
        domainName: domain.name,
        description: domain.description,
        competencies: domainComps.slice(0, 6).map((c) => ({
          id: c.id,
          title: c.title,
          category: c.category,
          difficulty: c.difficulty,
        })),
        totalCompetencies: domainComps.length,
      } : null;
      return NextResponse.json({ goal, preview });
    }

    const goals = await learningStateService.getUserGoals(userId);
    const activeGoalData = await learningStateService.getActiveGoal(userId);

    return NextResponse.json({
      goals,
      activeGoal: activeGoalData?.goal || null,
      profile: activeGoalData?.profile || null,
    });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rawObjective, selectedDomainId, targetOutcome, selfReportedLevel, deadline } = body;

    if (!rawObjective) {
      return NextResponse.json(
        { error: "rawObjective is required." },
        { status: 400 }
      );
    }

    // Dynamic AI curriculum generation for arbitrary learning objectives
    let effectiveDomainId = selectedDomainId;
    if (
      !effectiveDomainId ||
      effectiveDomainId === "auto" ||
      effectiveDomainId === "dynamic" ||
      !getDomain(effectiveDomainId)
    ) {
      const { domain } = await aiCurriculumService.generateCurriculumForObjective(
        rawObjective,
        userId
      );
      effectiveDomainId = domain.id;
    }

    const result = await learningStateService.createGoal(userId, {
      rawObjective,
      selectedDomainId: effectiveDomainId,
      targetOutcome,
      selfReportedLevel,
      deadline,
      userId,
    });

    const domain = getDomain(effectiveDomainId);
    const domainComps = getCuratedCompetenciesByDomain(effectiveDomainId);
    const preview = domain ? {
      domainId: domain.id,
      domainName: domain.name,
      description: domain.description,
      competencies: domainComps.slice(0, 6).map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        difficulty: c.difficulty,
      })),
      totalCompetencies: domainComps.length,
    } : null;

    productEventService.recordEvent(
      userId,
      "goal_created",
      {
        goalId: result.goal.id,
        domainId: result.goal.domainId,
        rawObjective,
        targetOutcome: result.goal.targetOutcome,
        selfReportedLevel,
      },
      result.goal.id,
      result.goal.domainId
    );

    return NextResponse.json({ ...result, preview }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { activeGoalId } = body;

    if (!activeGoalId) {
      return NextResponse.json({ error: "activeGoalId is required." }, { status: 400 });
    }

    const profile = await learningStateService.setActiveGoal(userId, activeGoalId);

    productEventService.recordEvent(
      userId,
      "goal_updated",
      { activeGoalId },
      activeGoalId,
      profile.domainId
    );

    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
