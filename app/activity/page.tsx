"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";

interface PracticeData {
  id: string;
  prompt: string;
  itemType: "MULTIPLE_CHOICE" | "NUMERIC" | "TEXT";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hints: string[];
}

interface ActivityPayload {
  competencyId: string;
  domainId: string;
  title: string;
  category: "CONCEPTUAL" | "PROCEDURAL";
  objective: string;
  instruction: string;
  keyConcepts: string[];
  practice: PracticeData;
}

interface ActivityResult {
  success: boolean;
  score: number;
  evidence: {
    id: string;
    score: number;
    confidence: number;
    result: string;
    evidenceType: string;
    timestamp: string;
  };
  masteryOutput: {
    masteryScore: number;
    masteryState: string;
    confidenceScore: number;
  };
  gap: {
    status: string;
    severity?: number | string;
    reason?: string;
  } | null;
  nextRecommendation?: {
    id: string;
    action: string;
    competencyId: string;
    reason: string;
    priority: number;
    estimatedMinutes: number;
  };
}

function ActivityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalIdParam = searchParams.get("goalId");
  const competencyIdParam = searchParams.get("competencyId");
  const actionParam = (searchParams.get("action") || "PRACTICE").toUpperCase();
  const recIdParam = searchParams.get("recId") || undefined;

  const { userId, activeGoalId } = useLearner();
  const effectiveGoalId = goalIdParam || activeGoalId;

  const [activity, setActivity] = useState<ActivityPayload | null>(null);
  const [currentAction, setCurrentAction] = useState<string>(actionParam);
  const [currentRecId, setCurrentRecId] = useState<string | undefined>(recIdParam);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userResponse, setUserResponse] = useState("");
  const [feynmanExplanation, setFeynmanExplanation] = useState("");
  const [reviewRating, setReviewRating] = useState<"AGAIN" | "GOOD" | "EASY">("GOOD");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async (targetComp?: string, targetAct?: string, targetRecId?: string) => {
    if (!effectiveGoalId || !userId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setUserResponse("");
    setFeynmanExplanation("");
    setShowHint(false);

    try {
      let resolvedCompId = targetComp || competencyIdParam;
      let resolvedAction = targetAct || actionParam;

      // If no competency specified, retrieve authoritative Next Best Action
      if (!resolvedCompId) {
        const recRes = await fetch(`/api/learning/recommendation?goalId=${effectiveGoalId}`, {
          headers: { "x-user-id": userId },
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          if (recData.recommendation) {
            resolvedCompId = recData.recommendation.competencyId;
            resolvedAction = recData.recommendation.action || "LEARN";
            setCurrentRecId(recData.recommendation.id);
          }
        }
      }

      if (!resolvedCompId) {
        throw new Error("No competency identified for practice. Check your Learning Map.");
      }

      setCurrentAction(resolvedAction);
      if (targetRecId) setCurrentRecId(targetRecId);

      const res = await fetch(
        `/api/learning/activity?goalId=${effectiveGoalId}&competencyId=${resolvedCompId}&action=${resolvedAction}`,
        { headers: { "x-user-id": userId } }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load activity content");
      }

      const data = await res.json();
      setActivity(data.activity);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [effectiveGoalId, competencyIdParam, actionParam, userId]);

  useEffect(() => {
    if (effectiveGoalId && userId) {
      loadActivity();
    }
  }, [effectiveGoalId, userId, loadActivity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity || !effectiveGoalId || !userId) return;

    setSubmitting(true);
    setError(null);

    try {
      let numericScore = 80;
      let submittedResponse = userResponse;

      if (currentAction === "FEYNMAN") {
        submittedResponse = feynmanExplanation.trim();
        numericScore = submittedResponse.length > 60 ? 85 : 55;
      } else if (currentAction === "REVIEW") {
        numericScore = reviewRating === "AGAIN" ? 35 : reviewRating === "GOOD" ? 85 : 100;
        submittedResponse = reviewRating;
      } else {
        // Multiple choice or text practice
        const isCorrect =
          userResponse.trim().toLowerCase() ===
          activity.practice.correctAnswer.trim().toLowerCase();
        numericScore = isCorrect ? 95 : 40;
      }

      const res = await fetch("/api/learning/activity/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          goalId: effectiveGoalId,
          competencyId: activity.competencyId,
          action: currentAction,
          score: numericScore,
          response: submittedResponse,
          recommendationId: currentRecId,
          metadata: {
            itemPrompt: activity.practice.prompt,
            category: activity.category,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit activity evidence");
      }

      const data = await res.json();
      setResult({
        ...data,
        score: numericScore,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueNext = () => {
    if (result?.nextRecommendation) {
      const nextComp = result.nextRecommendation.competencyId;
      const nextAct = result.nextRecommendation.action;
      const nextRecId = result.nextRecommendation.id;
      loadActivity(nextComp, nextAct, nextRecId);
    } else {
      router.push("/");
    }
  };

  if (!effectiveGoalId) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-light text-white font-serif">No Learning Goal Selected</h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Create or choose a goal to launch personalized lessons.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl font-medium text-xs bg-white text-[#07090e] hover:bg-slate-200 transition-colors"
        >
          Select Goal →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-10 sm:py-16">
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Loading next lesson...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 space-y-4">
          <div className="font-semibold text-sm">Lesson Error</div>
          <p className="text-xs leading-relaxed">{error}</p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => loadActivity()}
              className="px-4 py-2 rounded-xl bg-white text-[#07090e] text-xs font-medium hover:bg-slate-200 transition-colors"
            >
              Retry
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      ) : result ? (
        /* ==========================================================
           POST-SUBMISSION: GENUINE EVIDENCE & ADAPTIVE NEXT ACTION
           ========================================================== */
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase bg-white/[0.04] text-emerald-400 border border-white/[0.08]">
              <span>✓ Evidence Verified</span>
              <span className="text-slate-600">•</span>
              <span className="text-white">Score {result.score}%</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white font-serif">
              Mastery Recalibrated
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg">
              Your response has been verified by the Learning Engine. Mastery is now{" "}
              <span className="text-white font-medium">
                {result.masteryOutput.masteryScore.toFixed(0)}%
              </span>{" "}
              ({result.masteryOutput.masteryState}).
            </p>
          </div>

          {/* Pedagogical Takeaway */}
          {activity?.practice.explanation && (
            <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#0c1018] space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Key Takeaway
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {activity.practice.explanation}
              </p>
            </div>
          )}

          {/* Adaptive Next Best Action Card */}
          {result.nextRecommendation && (
            <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#0c1018] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400">
                  Recommended Next Step
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  Action: {result.nextRecommendation.action}
                </span>
              </div>
              <div className="text-sm font-medium text-white">
                {result.nextRecommendation.competencyId.replace(/^[a-z]+-/, "").replace(/-/g, " ")}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {result.nextRecommendation.reason}
              </p>
            </div>
          )}

          {/* Single Dominant CTA */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <button
              id="activity-continue-next-button"
              onClick={handleContinueNext}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-medium text-xs sm:text-sm text-[#07090e] bg-white hover:bg-slate-200 transition-all tracking-wide shadow-lg flex items-center justify-center gap-2"
            >
              {result.nextRecommendation
                ? `Continue: ${result.nextRecommendation.action} →`
                : "Back to Home →"}
            </button>

            <Link
              href={`/map?goalId=${effectiveGoalId}`}
              className="text-xs text-slate-400 hover:text-white px-3 py-2 transition-colors whitespace-nowrap"
            >
              View Learning Map
            </Link>
          </div>
        </div>
      ) : activity ? (
        /* ==========================================================
           FOCUSED LEARNING SCREEN: COMPETENCY, INSTRUCTION & ACTIVITY
           ========================================================== */
        <div className="space-y-8 animate-fade-in">
          {/* Header & Competency */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase bg-white/[0.04] text-slate-400 border border-white/[0.08]">
              <span>{activity.category}</span>
              <span className="text-slate-600">•</span>
              <span className="text-white">{currentAction}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-white font-serif">
              {activity.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {activity.instruction}
            </p>
          </div>

          {/* Key Concepts (concise bullets if available) */}
          {activity.keyConcepts && activity.keyConcepts.length > 0 && (
            <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0c1018]/60 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Core Principles
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {activity.keyConcepts.map((kc, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-slate-600">•</span>
                    <span>{kc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The Actual Activity Form */}
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Demonstrate Understanding
              </div>
              <h2 className="text-base sm:text-lg font-light text-white leading-relaxed">
                {activity.practice.prompt}
              </h2>
            </div>

            {/* Multiple Choice Format */}
            {activity.practice.options && activity.practice.options.length > 0 && (
              <div className="space-y-2">
                {activity.practice.options.map((opt, optIdx) => {
                  const isSelected = userResponse === opt;
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => setUserResponse(opt)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                        isSelected
                          ? "border-white bg-white/[0.08] text-white shadow-sm"
                          : "border-white/[0.06] bg-[#0c1018] text-slate-300 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded ${
                          isSelected
                            ? "bg-white text-[#07090e] font-semibold"
                            : "bg-white/[0.04] text-slate-500"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-xs sm:text-sm font-normal leading-relaxed flex-1">
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Written Explanation / Feynman Format */}
            {currentAction === "FEYNMAN" && (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={feynmanExplanation}
                  onChange={(e) => setFeynmanExplanation(e.target.value)}
                  placeholder="Explain using simple intuition, free of jargon. How would you teach this to a curious beginner?"
                  className="w-full bg-[#0c1018] border border-white/[0.08] focus:border-white/30 rounded-xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors leading-relaxed"
                />
                <div className="text-[11px] font-mono text-slate-500 text-right">
                  {feynmanExplanation.trim().length} characters
                </div>
              </div>
            )}

            {/* Spaced Retrieval / Review Format */}
            {currentAction === "REVIEW" && (
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { value: "AGAIN", label: "Hard", desc: "Need practice" },
                  { value: "GOOD", label: "Good", desc: "Remembered" },
                  { value: "EASY", label: "Easy", desc: "Intuitive" },
                ].map((tier) => (
                  <button
                    key={tier.value}
                    type="button"
                    onClick={() => setReviewRating(tier.value as "AGAIN" | "GOOD" | "EASY")}
                    className={`p-3.5 rounded-xl border text-center transition-all ${
                      reviewRating === tier.value
                        ? "border-white bg-white/[0.08] text-white"
                        : "border-white/[0.06] bg-[#0c1018] text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                  >
                    <div className="text-xs font-medium text-white">{tier.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{tier.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Free-text input fallback for non-MC without Feynman */}
            {!activity.practice.options && currentAction !== "FEYNMAN" && currentAction !== "REVIEW" && (
              <input
                type="text"
                placeholder="Type your answer or solution..."
                value={userResponse}
                onChange={(e) => setUserResponse(e.target.value)}
                className="w-full bg-[#0c1018] border border-white/[0.08] focus:border-white/30 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            )}

            {/* Hint expander */}
            {activity.practice.hints && activity.practice.hints.length > 0 && (
              <div className="text-xs">
                {showHint ? (
                  <div className="p-3 rounded-xl border border-white/[0.06] bg-[#0c1018]/50 text-slate-300">
                    <span className="text-amber-400 font-medium">Hint:</span>{" "}
                    {activity.practice.hints[0]}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowHint(true)}
                    className="text-slate-500 hover:text-slate-400 text-xs transition-colors"
                  >
                    Need a hint?
                  </button>
                )}
              </div>
            )}

            {/* Single dominant submit CTA */}
            <div className="pt-2 flex items-center justify-between">
              <Link
                href="/"
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                ← Exit
              </Link>

              <button
                id="activity-submit-button"
                type="submit"
                disabled={
                  submitting ||
                  (currentAction === "FEYNMAN"
                    ? !feynmanExplanation.trim()
                    : currentAction === "REVIEW"
                    ? false
                    : !userResponse.trim())
                }
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#07090e] bg-white hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {submitting
                  ? "Evaluating..."
                  : currentAction === "FEYNMAN"
                  ? "Submit explanation →"
                  : currentAction === "REVIEW"
                  ? "Record review →"
                  : "Check answer →"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-[#f6f3eb] flex flex-col font-sans selection:bg-white/20 selection:text-white antialiased">
      <LearnerNav />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center">
        <Suspense
          fallback={
            <div className="py-24 text-center text-xs font-mono text-slate-500 uppercase tracking-wider">
              Loading lesson...
            </div>
          }
        >
          <ActivityContent />
        </Suspense>
      </main>
    </div>
  );
}
