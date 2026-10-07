import { randomUUID as uuidv4 } from "crypto";
import { learningStateService, UnauthorizedAccessError } from "./learning-state-service";
import { masteryService } from "./mastery-service";
import { getCompetencyById } from "../curriculum";
import { evaluateFeynmanExplanationWithAI } from "@/lib/ai/feynman";
import { FeynmanEvaluation, FEYNMAN_RUBRIC_VERSION } from "../feynman/rubric";
import { MasteryCalculationOutput } from "../mastery";
import { supabasePersistence } from "@/lib/db/supabase-persistence";

export interface FeynmanSessionEntity {
  id: string;
  userId: string;
  learningGoalId: string;
  competencyId: string;
  prompt: string;
  learnerExplanation?: string;
  evaluation?: FeynmanEvaluation;
  status: "PENDING" | "STARTED" | "SUBMITTED" | "EVALUATED";
  algorithmVersion: string;
  createdAt: string;
  submittedAt?: string;
  evaluatedAt?: string;
}

export function generateFeynmanPrompt(competencyTitle: string): string {
  return `In your own words, explain "${competencyTitle}" as if you were explaining it to someone with no background in this subject. Clearly describe what it is, how it works, and a concrete example.`;
}

/**
 * FeynmanService (§4, §5, §7, §27, §29)
 * Orchestrates deterministic Feynman explanation sessions, structured evaluation,
 * safe AI failure handling, and append-only evidence recording.
 */
export class FeynmanService {
  private sessions: Map<string, FeynmanSessionEntity> = new Map();

  /**
   * Starts or retrieves an active Feynman session for a competency (§4)
   */
  async startSession(
    userId: string,
    goalId: string,
    competencyId: string
  ): Promise<FeynmanSessionEntity> {
    await learningStateService.getGoal(userId, goalId);

    const competency = getCompetencyById(competencyId);
    if (!competency) {
      throw new Error(`Competency '${competencyId}' not found.`);
    }

    // Check if an uncompleted session already exists
    const existing = Array.from(this.sessions.values()).find(
      (s) =>
        s.userId === userId &&
        s.learningGoalId === goalId &&
        s.competencyId === competencyId &&
        (s.status === "STARTED" || s.status === "PENDING")
    );

    if (existing) {
      return existing;
    }

    const prompt = generateFeynmanPrompt(competency.title);
    const session: FeynmanSessionEntity = {
      id: uuidv4(),
      userId,
      learningGoalId: goalId,
      competencyId,
      prompt,
      status: "STARTED",
      algorithmVersion: FEYNMAN_RUBRIC_VERSION,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    await supabasePersistence.persistFeynmanSession(session);
    return session;
  }

  /**
   * Submits learner explanation, invokes structured AI evaluation,
   * records append-only evidence upon success, and recalculates mastery (§5, §7, §27).
   */
  async submitExplanation(
    userId: string,
    sessionId: string,
    explanation: string
  ): Promise<{
    success: boolean;
    session?: FeynmanSessionEntity;
    masteryOutput?: MasteryCalculationOutput;
    error?: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Feynman session '${sessionId}' not found.`);
    }
    if (session.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot submit explanation to another user's session.");
    }

    if (session.status === "EVALUATED") {
      // Idempotency: Return already evaluated session
      return { success: true, session };
    }

    const competency = getCompetencyById(session.competencyId);
    if (!competency) {
      throw new Error(`Competency '${session.competencyId}' not found.`);
    }

    const now = new Date().toISOString();
    session.learnerExplanation = explanation;
    session.submittedAt = now;
    session.status = "SUBMITTED";

    // Invoke AI Evaluator (§26)
    const evalResult = await evaluateFeynmanExplanationWithAI({
      competency,
      prompt: session.prompt,
      explanation,
      userId,
    });

    // Handle Safe Model Failure (§27): If AI evaluation fails, no evidence is created!
    if (!evalResult.success || !evalResult.evaluation) {
      return {
        success: false,
        session,
        error: evalResult.error || "Feynman evaluation temporarily unavailable. No learning evidence recorded.",
      };
    }

    const evaluation = evalResult.evaluation;
    session.evaluation = evaluation;
    session.status = "EVALUATED";
    session.evaluatedAt = new Date().toISOString();
    await supabasePersistence.persistFeynmanSession(session);

    // Append-only Evidence Recording (§7)
    // Only real evaluated outcome becomes evidence
    await learningStateService.recordFeynmanEvidence(
      userId,
      session.learningGoalId,
      session.competencyId,
      evaluation.overall_score,
      evaluation.confidence,
      {
        sessionId: session.id,
        rubricVersion: evaluation.rubric_version,
        correctness: evaluation.correctness,
        completeness: evaluation.completeness,
        simplicity: evaluation.simplicity,
        causalReasoning: evaluation.causal_reasoning,
        misconceptionPenalty: evaluation.misconception_penalty,
        missingConcepts: evaluation.missing_concepts,
        misconceptions: evaluation.misconceptions,
      }
    );

    // Recalculate Mastery via Learning Engine (§2)
    const { masteryOutput } = await masteryService.recalculateCompetencyMastery(
      userId,
      session.learningGoalId,
      session.competencyId,
      "FEYNMAN_EVALUATION"
    );

    return {
      success: true,
      session,
      masteryOutput,
    };
  }

  async getSession(userId: string, sessionId: string): Promise<FeynmanSessionEntity> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Feynman session '${sessionId}' not found.`);
    }
    if (session.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot access Feynman session belonging to another user.");
    }
    return session;
  }
}

export const feynmanService = new FeynmanService();
