import { describe, it, expect } from "vitest";
import { generateAdaptiveLearningPlan } from "@/lib/learning/learning-plan";
import { LearnerCompetencyState } from "@/lib/learning/recommendations";
import { LearningGap } from "@/lib/learning/gap-analysis";
import { PrerequisiteGraph } from "@/lib/learning/prerequisite-graph";
import { PYTHON_COMPETENCIES } from "@/lib/learning/curriculum/python";

describe("Adaptive Learning Plan (§24, §25, §26, §55)", () => {
  const graph = new PrerequisiteGraph(PYTHON_COMPETENCIES);

  it("dynamically projects plan from initial learner state (§24)", () => {
    const states = new Map<string, LearnerCompetencyState>();
    const gaps = new Map<string, LearningGap>();

    const context = {
      userId: "user-1",
      learningGoalId: "goal-1",
      objective: {
        domainId: "python-junior",
        targetOutcome: "Junior Python Engineer",
      },
      competencyStates: states,
      gaps,
      prerequisiteGraph: graph,
      allCompetencies: PYTHON_COMPETENCIES,
    };

    const plan = generateAdaptiveLearningPlan(context);

    expect(plan.goalId).toBe("goal-1");
    expect(plan.domainId).toBe("python-junior");
    expect(plan.steps.length).toBe(PYTHON_COMPETENCIES.length);
    expect(plan.completedStepsCount).toBe(0);
    expect(plan.activeStep).toBeDefined();
    expect(plan.activeStep?.competencyId).toBe("py-variables-types");
    expect(plan.activeStep?.action).toBe("LEARN");
    expect(plan.totalEstimatedMinutes).toBeGreaterThan(0);
  });

  it("dynamically recomputes plan when evidence and mastery changes (§26, §55)", () => {
    // Initial: py-variables-types has open gap
    const states = new Map<string, LearnerCompetencyState>();
    states.set("py-variables-types", {
      competencyId: "py-variables-types",
      masteryScore: 40,
      confidenceScore: 0.8,
      evidenceCount: 3,
    });

    const gaps = new Map<string, LearningGap>();
    gaps.set("py-variables-types", {
      id: "gap-1",
      userId: "u1",
      learningGoalId: "g1",
      competencyId: "py-variables-types",
      severity: "HIGH",
      masteryScore: 40,
      confidenceScore: 0.8,
      signals: [{ type: "EXERCISE_FAILURE", description: "Fail", observedScore: 40 }],
      reason: "Gap",
      status: "OPEN",
      detectedAt: new Date().toISOString(),
      version: 1,
    });

    const context1 = {
      userId: "user-1",
      learningGoalId: "goal-1",
      objective: { domainId: "python-junior" },
      competencyStates: states,
      gaps,
      prerequisiteGraph: graph,
      allCompetencies: PYTHON_COMPETENCIES,
    };

    const plan1 = generateAdaptiveLearningPlan(context1);
    expect(plan1.activeStep?.competencyId).toBe("py-variables-types");
    expect(plan1.activeStep?.action).toBe("REMEDIATE");

    // Later: learner completes exercises and achieves 88% mastery, gap resolved
    states.set("py-variables-types", {
      competencyId: "py-variables-types",
      masteryScore: 88,
      confidenceScore: 0.85,
      evidenceCount: 5,
    });
    gaps.delete("py-variables-types");

    const context2 = {
      userId: "user-1",
      learningGoalId: "goal-1",
      objective: { domainId: "python-junior" },
      competencyStates: states,
      gaps,
      prerequisiteGraph: graph,
      allCompetencies: PYTHON_COMPETENCIES,
    };

    const plan2 = generateAdaptiveLearningPlan(context2);

    // py-variables-types is now COMPLETED
    expect(plan2.completedStepsCount).toBe(1);
    const completedStep = plan2.steps.find((s) => s.competencyId === "py-variables-types");
    expect(completedStep?.status).toBe("COMPLETED");

    // Active step has advanced to the next unblocked downstream competency
    expect(plan2.activeStep?.competencyId).not.toBe("py-variables-types");
    expect(plan2.activeStep?.status).toBe("ACTIVE");
  });
});
