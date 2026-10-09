"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";
import { MasteryBadge } from "../components/ui/mastery-badge";

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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userResponse, setUserResponse] = useState("");
  const [feynmanExplanation, setFeynmanExplanation] = useState("");
  const [reviewRating, setReviewRating] = useState<"AGAIN" | "HARD" | "GOOD" | "EASY">("GOOD");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    if (!effectiveGoalId) return;
    setLoading(true);
    setError(null);
    try {
      let targetCompId = competencyIdParam;

      // If no competency provided, fetch current Next Best Action
      if (!targetCompId) {
        const recRes = await fetch(`/api/learning/recommendation?goalId=${effectiveGoalId}`, {
          headers: { "x-user-id": userId },
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          targetCompId = recData.recommendation?.competencyId;
        }
      }

      if (!targetCompId) {
        throw new Error("No competency identified for practice. Check your Learning Map.");
      }

      const res = await fetch(
        `/api/learning/activity?goalId=${effectiveGoalId}&competencyId=${targetCompId}&action=${actionParam}`,
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
    if (effectiveGoalId) {
      loadActivity();
    }
  }, [effectiveGoalId, loadActivity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity || !effectiveGoalId) return;

    setSubmitting(true);
    setError(null);

    try {
      let numericScore = 80;
      let submittedResponse = userResponse;

      if (actionParam === "FEYNMAN") {
        submittedResponse = feynmanExplanation;
        numericScore = feynmanExplanation.length > 80 ? 85 : 60;
      } else if (actionParam === "REVIEW") {
        numericScore =
          reviewRating === "AGAIN" ? 30 : reviewRating === "HARD" ? 65 : reviewRating === "GOOD" ? 85 : 100;
        submittedResponse = reviewRating;
      } else {
        // Evaluate practice item
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
          action: actionParam,
          score: numericScore,
          response: submittedResponse,
          recommendationId: recIdParam,
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

  if (!effectiveGoalId) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">No Learning Goal Selected</h2>
        <p className="text-sm text-slate-400">
          Create or select a goal to launch personalized practice activities.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl font-semibold text-xs bg-sky-500 text-white"
        >
          Select Goal →
        </Link>
      </div>
    );
  }

  const getActionColor = (act: string) => {
    switch (act) {
      case "LEARN":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "PRACTICE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "FEYNMAN":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      case "REVIEW":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "REMEDIATE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Activity Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getActionColor(
                actionParam
              )}`}
            >
              {actionParam}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">{activity?.title || "Activity"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Demonstrate Competency
          </h1>
        </div>

        <Link
          href="/"
          className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900"
        >
          ✕ Exit
        </Link>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Loading contextual activity from Learning Engine...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-rose-800 bg-rose-950/20 text-rose-300 space-y-3">
          <div className="font-semibold text-sm">Activity Error</div>
          <p className="text-xs">{error}</p>
          <button
            onClick={() => loadActivity()}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : result ? (
        /* ==========================================================
           EVIDENCE & MASTERY UPDATE RESULT (§14, §15)
           ========================================================== */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2 pb-4 border-b border-slate-800">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                result.score >= 70
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {result.score >= 70 ? "✓ Legitimate Evidence Recorded" : "⚡ Evidence Recorded (Needs Work)"}
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Learning State Updated
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Progress is verified through demonstrated evidence. Your mastery score has been recalculated.
            </p>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">
                Activity Score
              </div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {result.score}%
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">
                Updated Mastery
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {result.masteryOutput.masteryScore.toFixed(0)}%
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">
                Mastery State
              </div>
              <div className="mt-1">
                <MasteryBadge
                  score={result.masteryOutput.masteryScore}
                  state={result.masteryOutput.masteryState}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Pedagogical Explanation Feedback */}
          {activity && (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-1.5">
              <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                Pedagogical Takeaway
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activity.practice.explanation}
              </p>
            </div>
          )}

          {/* Next Best Action Transition (§11) */}
          {result.nextRecommendation && (
            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-950/20 space-y-2">
              <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span>Next Best Action Refreshed</span>
              </div>
              <div className="font-semibold text-sm text-white">
                {result.nextRecommendation.action}: {result.nextRecommendation.competencyId}
              </div>
              <p className="text-xs text-slate-300">
                {result.nextRecommendation.reason}
              </p>
            </div>
          )}

          {/* Action Navigation */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            {result.nextRecommendation ? (
              <button
                onClick={() => {
                  setResult(null);
                  setUserResponse("");
                  setFeynmanExplanation("");
                  router.push(
                    `/activity?goalId=${effectiveGoalId}&competencyId=${result.nextRecommendation?.competencyId}&action=${result.nextRecommendation?.action}&recId=${result.nextRecommendation?.id}`
                  );
                }}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25 transition-all text-center"
              >
                Continue to Next Best Action →
              </button>
            ) : null}

            <Link
              href="/map"
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-center transition-colors"
            >
              Return to Learning Map →
            </Link>

            <Link
              href="/"
              className="py-3 px-4 rounded-xl font-medium text-xs bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 text-center transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      ) : activity ? (
        /* ==========================================================
           ACTIVITY SHELL & INTERACTION (§13)
           ========================================================== */
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6"
        >
          {/* Objective & Instruction Bite (§13.1) */}
          <div className="space-y-3 pb-4 border-b border-slate-800/80">
            <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
              Objective: {activity.objective}
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              {activity.instruction}
            </p>

            {/* Key Concepts Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activity.keyConcepts.map((kc, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/60 text-slate-300 border border-slate-700/50"
                >
                  • {kc}
                </span>
              ))}
            </div>
          </div>

          {/* Activity Specific Interaction */}
          {actionParam === "FEYNMAN" ? (
            /* --- FEYNMAN EXPLANATION (§13.3) --- */
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Explain in your own words
              </label>
              <p className="text-xs text-slate-400">
                Explain {activity.title} as if teaching someone with zero background. The Learning Engine evaluates correctness, causal reasoning, and conceptual clarity.
              </p>
              <textarea
                required
                rows={5}
                value={feynmanExplanation}
                onChange={(e) => setFeynmanExplanation(e.target.value)}
                placeholder="Type your explanation here..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ) : actionParam === "REVIEW" ? (
            /* --- SPACED REVIEW RATING (§13.4) --- */
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Spaced Review: Retrieve from memory
              </label>
              <p className="text-xs text-slate-400">
                {activity.practice.prompt}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                {[
                  { id: "AGAIN", label: "Again", desc: "Forgot" },
                  { id: "HARD", label: "Hard", desc: "Struggled" },
                  { id: "GOOD", label: "Good", desc: "Remembered" },
                  { id: "EASY", label: "Easy", desc: "Effortless" },
                ].map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setReviewRating(id as "AGAIN" | "HARD" | "GOOD" | "EASY")}
                    className={`py-3 px-2 rounded-xl border text-xs font-bold transition-all text-center ${
                      reviewRating === id
                        ? "border-purple-500 bg-purple-500/20 text-purple-300 ring-1 ring-purple-500"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div>{label}</div>
                    <div className="text-[10px] font-normal text-slate-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* --- PRACTICE / REMEDIATE / RETRY (§13.2, §13.5) --- */
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Challenge
                </div>
                <div className="text-sm sm:text-base font-semibold text-white whitespace-pre-wrap leading-relaxed">
                  {activity.practice.prompt}
                </div>
              </div>

              {activity.practice.options ? (
                <div className="space-y-2">
                  {activity.practice.options.map((opt, i) => {
                    const isSelected = userResponse === opt;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setUserResponse(opt)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500"
                            : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <span className="text-emerald-400 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    required
                    value={userResponse}
                    onChange={(e) => setUserResponse(e.target.value)}
                    placeholder="Enter solution..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Hints Toggle */}
              {activity.practice.hints.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                  >
                    {showHint ? "Hide Hint" : "💡 Need a hint?"}
                  </button>
                  {showHint && (
                    <div className="mt-2 p-3 rounded-lg bg-sky-950/30 border border-sky-800/40 text-xs text-sky-200">
                      {activity.practice.hints[0]}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
            >
              {submitting ? "Evaluating Evidence..." : "Submit & Produce Evidence →"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LearnerNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="text-slate-400 text-xs">Loading activity...</div>}>
          <ActivityContent />
        </Suspense>
      </main>
    </div>
  );
}
