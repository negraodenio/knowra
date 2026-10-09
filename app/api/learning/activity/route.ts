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

    let comp = getCompetencyById(competencyId);
    if (!comp) {
      const { dynamicCurriculumRegistry } = await import("@/lib/learning/curriculum/dynamic-registry");
      comp = await dynamicCurriculumRegistry.ensureCompetencyLoaded(competencyId);
    }

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
      objective: `Demonstrar domínio em ${comp.title}`,
      instruction: comp.description,
      keyConcepts: [
        `Fundamentos de ${comp.title}`,
        "Aplicação prática e raciocínio crítico",
        "Resolução de problemas conceituais",
      ],
      practice: {
        id: `gen-prac-${comp.id}`,
        prompt:
          action === "FEYNMAN"
            ? `Explique com suas próprias palavras os conceitos essenciais de "${comp.title}". Use uma analogia simples e evite jargões técnicos para demonstrar clareza mental.`
            : `Explique e analise os fundamentos e a aplicação prática de "${comp.title}".`,
        itemType: "TEXT",
        correctAnswer: "Uma explicação abrangente demonstrando clareza conceitual e articulação clara.",
        explanation: "O domínio real exige a capacidade de explicar os mecanismos causais sem depender de decoreba.",
        hints: [`Objetivo central: ${comp.description}`, "Tente usar um exemplo prático do mundo real."],
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
    if (
      err instanceof UnauthorizedAccessError ||
      (err as { name?: string })?.name === "UnauthorizedAccessError" ||
      (err as { message?: string })?.message?.includes("Access denied")
    ) {
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
