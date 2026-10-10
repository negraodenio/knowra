"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";
import { DiagnosticItem, DiagnosticCompletionReport } from "@/lib/learning/diagnostic/types";

interface DiagnosticReport extends DiagnosticCompletionReport {
  learningGoalId: string;
}

function DiagnosticContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalIdParam = searchParams.get("goalId");
  const { userId, activeGoal, refreshGoals } = useLearner();

  const effectiveGoalId = goalIdParam || activeGoal?.id;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const startDiagnosticSession = useCallback(async () => {
    if (!effectiveGoalId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostic/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ goalId: effectiveGoalId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start diagnostic session");
      }

      const data = await res.json();
      setSessionId(data.session.id);
      const fetchedItems: DiagnosticItem[] = data.items || [];
      setItems(fetchedItems);

      if (data.report) {
        setReport(data.report);
        return;
      }

      // Restore existing answers if resuming an in-progress session
      if (data.existingAnswers && Object.keys(data.existingAnswers).length > 0) {
        setAnswers(data.existingAnswers);
        const firstUnanswered = fetchedItems.findIndex((it) => !data.existingAnswers[it.id]);
        if (firstUnanswered !== -1) {
          setCurrentIndex(firstUnanswered);
        } else {
          setCurrentIndex(Math.max(0, fetchedItems.length - 1));
        }
      } else {
        setCurrentIndex(0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (typeof window !== "undefined" && msg.includes("not found")) {
        localStorage.removeItem("knowra_learner_active_goal_id");
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveGoalId, userId]);

  useEffect(() => {
    if (effectiveGoalId && !sessionId && !report && userId) {
      startDiagnosticSession();
    }
  }, [effectiveGoalId, sessionId, report, userId, startDiagnosticSession]);

  const handleSelectAnswer = (ans: string) => {
    const currentItem = items[currentIndex];
    if (!currentItem) return;
    setAnswers((prev) => ({ ...prev, [currentItem.id]: ans }));
    if (error) setError(null);
  };

  const handleNextOrFinish = async () => {
    if (!sessionId || !userId || submitting) return;
    const currentItem = items[currentIndex];
    if (!currentItem) return;
    const currentAnswer = answers[currentItem.id] || "";

    if (!currentAnswer.trim()) {
      setError("Please select or enter an answer before continuing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // 1. Submit answer to server with error verification
    try {
      const res = await fetch(`/api/diagnostic/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          itemId: currentItem.id,
          answer: currentAnswer,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record answer. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record answer.");
      setSubmitting(false);
      return;
    }

    const updatedAnswers = { ...answers, [currentItem.id]: currentAnswer };

    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSubmitting(false);
    } else {
      // 2. We reached the last question. Verify all prior questions have answers.
      const missingIndex = items.findIndex((it) => !updatedAnswers[it.id]?.trim());
      if (missingIndex !== -1 && missingIndex !== currentIndex) {
        setCurrentIndex(missingIndex);
        setError(`Please answer question ${missingIndex + 1} of ${items.length} to complete your diagnostic.`);
        setSubmitting(false);
        return;
      }

      // 3. Complete Diagnostic
      try {
        const completeRes = await fetch(`/api/diagnostic/${sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
        });

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to complete diagnostic");
        }

        const rep = await completeRes.json();
        setReport(rep);
        await refreshGoals();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (!effectiveGoalId) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-light text-white font-serif">No Learning Goal Selected</h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Create or select a learning path first to begin your diagnostic.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl font-medium text-xs bg-[#F4F4F0] text-[#0C0C0D] hover:bg-white transition-colors"
        >
          Go to Home →
        </Link>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const progressPercent = items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0;
  const currentAnswer = currentItem ? answers[currentItem.id] : "";

  return (
    <div className="max-w-xl mx-auto py-10 sm:py-16">
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Calibrating diagnostic questions...
          </p>
        </div>
      ) : error && !currentItem ? (
        <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 space-y-4">
          <div className="font-semibold text-sm">Diagnostic Error</div>
          <p className="text-xs leading-relaxed">{error}</p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => startDiagnosticSession()}
              className="px-4 py-2 rounded-xl bg-[#F4F4F0] text-[#0C0C0D] text-xs font-medium hover:bg-white transition-colors"
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
      ) : report ? (
        /* ==========================================================
           POST-DIAGNOSTIC SUMMARY: CALM, TRUTHFUL, ONE DOMINANT CTA
           ========================================================== */
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase bg-white/[0.04] text-[#C95C3F] border border-white/[0.08]">
              <span>Diagnostic Complete</span>
              <span className="text-slate-600">•</span>
              <span>Baseline Established</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white font-serif leading-tight">
              Your starting benchmark is {report.overallBaselineScore.toFixed(1)}%.
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg">
              This is not a grade. It is an immutable calibration point that enables Knowra to isolate learning gaps and prove genuine learning gain over time.
            </p>
          </div>

          {/* Transparent, calm baseline breakdown */}
          {report.relativeStrengths && report.relativeStrengths.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl border border-white/[0.06] bg-[#161617] space-y-2.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#C95C3F]">
                Verified Prior Knowledge
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                Prior competence detected in:{" "}
                <span className="text-white font-medium">
                  {report.relativeStrengths.slice(0, 3).join(", ")}
                </span>
                . You will not be forced through repetitive introductory material.
              </div>
            </div>
          )}

          {/* Flagged learning gaps / lower baselines preview */}
          {report.lowerBaselines && report.lowerBaselines.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl border border-white/[0.06] bg-[#161617] space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#C95C3F]">
                Identified Starting Focus
              </div>
              <div className="space-y-2">
                {report.lowerBaselines.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-medium text-white">
                        {item}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Needs targeted practice to build foundation
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single primary action CTA */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <button
              id="diagnostic-start-lesson-button"
              onClick={() => router.push(`/activity?goalId=${report.learningGoalId}`)}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-medium text-xs sm:text-sm text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white transition-all tracking-wide shadow-lg flex items-center justify-center gap-2"
            >
              Start my first lesson →
            </button>

            <Link
              href={`/map?goalId=${report.learningGoalId}`}
              className="text-xs text-slate-400 hover:text-white px-3 py-2 transition-colors whitespace-nowrap"
            >
              View Learning Map
            </Link>
          </div>
        </div>
      ) : currentItem ? (
        /* ==========================================================
           DISTRACTION-FREE DIAGNOSTIC QUESTION
           ========================================================== */
        <div className="space-y-6 animate-fade-in">
          {/* Subtle Progress Indicator & Question Navigation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>
                Question {currentIndex + 1} of {items.length}
              </span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>

            <div className="h-0.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C95C3F] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Item Navigation Dots */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {items.map((it, idx) => {
                const hasAnswer = Boolean(answers[it.id]?.trim());
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setError(null);
                      setCurrentIndex(idx);
                    }}
                    className={`w-6 h-6 rounded-md text-[10px] font-mono flex items-center justify-center transition-all ${
                      isCurrent
                        ? "bg-[#C95C3F] text-[#F4F4F0] font-bold ring-2 ring-[#C95C3F]/40"
                        : hasAnswer
                        ? "bg-white/[0.08] text-[#F4F4F0] hover:bg-white/[0.14]"
                        : "bg-white/[0.02] text-[#A3A3A3]/50 border border-white/[0.06] hover:border-white/20"
                    }`}
                    title={`Question ${idx + 1}${hasAnswer ? " (Answered)" : " (Unanswered)"}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Error Banner (Non-destructive) */}
          {error && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between gap-3 animate-fade-in font-mono">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-200 text-xs font-mono font-bold px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Question Prompt Card */}
          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#161617] space-y-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#C95C3F]">
              {currentItem.competencyId.replace(/^[a-z]+-/, "").replace(/-/g, " ")}
            </div>
            <h2 className="text-base sm:text-lg font-light text-[#F4F4F0] leading-relaxed">
              {currentItem.prompt}
            </h2>

            {/* Answer Controls */}
            <div className="space-y-2.5 pt-2">
              {currentItem.options ? (
                <div className="space-y-2">
                  {currentItem.options.map((opt, optIdx) => {
                    const isSelected = currentAnswer === opt;
                    const letter = String.fromCharCode(65 + optIdx);
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectAnswer(opt)}
                        className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                          isSelected
                            ? "border-[#C95C3F] bg-[#C95C3F]/10 text-white shadow-sm"
                            : "border-white/[0.06] bg-[#0C0C0D] text-slate-300 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded ${
                            isSelected
                              ? "bg-[#C95C3F] text-[#F4F4F0] font-semibold"
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
              ) : (
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  value={currentAnswer}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  className="w-full bg-[#0C0C0D] border border-white/[0.08] focus:border-[#C95C3F] rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors font-mono"
                />
              )}
            </div>
          </div>

          {/* Advance or Submit Action */}
          <div className="pt-2 flex items-center justify-between">
            {currentIndex > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors py-2 px-3 rounded-lg border border-white/[0.06] bg-[#161617]"
              >
                ← Previous
              </button>
            ) : <div />}

            <button
              id="diagnostic-next-button"
              type="button"
              disabled={submitting || !currentAnswer}
              onClick={handleNextOrFinish}
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>{currentIndex === items.length - 1 ? "Completing..." : "Saving..."}</span>
                </>
              ) : currentIndex === items.length - 1 ? (
                "Complete diagnostic →"
              ) : (
                "Next question →"
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DiagnosticPage() {
  return (
    <div className="min-h-screen bg-[#0C0C0D] text-[#F4F4F0] flex flex-col font-sans selection:bg-[#C95C3F]/30 selection:text-[#F4F4F0] antialiased">
      <LearnerNav />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center">
        <Suspense
          fallback={
            <div className="py-24 text-center text-xs font-mono text-slate-500 uppercase tracking-wider">
              Loading diagnostic...
            </div>
          }
        >
          <DiagnosticContent />
        </Suspense>
      </main>
    </div>
  );
}
