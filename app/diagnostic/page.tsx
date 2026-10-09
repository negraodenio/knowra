"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";

interface DiagnosticItem {
  id: string;
  competencyId: string;
  prompt: string;
  itemType: "MULTIPLE_CHOICE" | "NUMERIC" | "TEXT";
  difficulty: number;
  options?: string[];
}

interface DiagnosticReport {
  sessionId: string;
  learningGoalId: string;
  domainId: string;
  overallBaselineScore: number;
  relativeStrengths: string[];
  lowerBaselines: string[];
}

function DiagnosticContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalIdParam = searchParams.get("goalId");

  const { userId, activeGoalId, goals, refreshGoals } = useLearner();
  const isGoalOwned = goals.some((g) => g.id === activeGoalId);
  const effectiveGoalId = goalIdParam || (isGoalOwned ? activeGoalId : null) || (goals.length > 0 ? goals[0].id : null);

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
        const err = await res.json();
        throw new Error(err.error || "Failed to start diagnostic session");
      }

      const data = await res.json();
      setSessionId(data.session.id);
      setItems(data.items || []);
      setCurrentIndex(0);
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
  };

  const handleNextOrFinish = async () => {
    if (!sessionId || !userId) return;
    const currentItem = items[currentIndex];
    const currentAnswer = answers[currentItem.id] || "";

    // Submit answer to server (§14)
    try {
      await fetch(`/api/diagnostic/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          itemId: currentItem.id,
          answer: currentAnswer,
        }),
      });
    } catch {
      // Best-effort answer persistence
    }

    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Complete Diagnostic
      setSubmitting(true);
      setError(null);
      try {
        const completeRes = await fetch(`/api/diagnostic/${sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
        });

        if (!completeRes.ok) {
          const err = await completeRes.json();
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
          className="inline-block px-5 py-2.5 rounded-xl font-medium text-xs bg-white text-[#07090e] hover:bg-slate-200 transition-colors"
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
      ) : error ? (
        <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 space-y-4">
          <div className="font-semibold text-sm">Diagnostic Error</div>
          <p className="text-xs leading-relaxed">{error}</p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => startDiagnosticSession()}
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
      ) : report ? (
        /* ==========================================================
           POST-DIAGNOSTIC SUMMARY: CALM, TRUTHFUL, ONE DOMINANT CTA
           ========================================================== */
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase bg-white/[0.04] text-emerald-400 border border-white/[0.08]">
              <span>✓ Baseline Calibrated</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white font-serif">
              Your Starting Point
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg">
              Your initial baseline is calibrated. The Learning Engine has prepared your first lesson based on prerequisite requirements.
            </p>
          </div>

          {/* Baseline metric */}
          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c1018] flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                Overall Baseline
              </div>
              <div className="text-3xl font-light font-mono text-white mt-1">
                {report.overallBaselineScore.toFixed(0)}%
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">Ready to learn</span>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">Engine calibrated</div>
            </div>
          </div>

          {/* Strengths & focus areas preview */}
          {(report.relativeStrengths.length > 0 || report.lowerBaselines.length > 0) && (
            <div className="space-y-3 text-xs">
              {report.relativeStrengths.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                    Recognized Strengths
                  </div>
                  <div className="space-y-1">
                    {report.relativeStrengths.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="text-slate-300 flex items-center gap-2">
                        <span className="text-emerald-400 text-xs">✓</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.lowerBaselines.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                    Target Focus Areas
                  </div>
                  <div className="space-y-1">
                    {report.lowerBaselines.slice(0, 3).map((b, idx) => (
                      <div key={idx} className="text-slate-300 flex items-center gap-2">
                        <span className="text-amber-400 text-xs">•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Single primary action CTA */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <button
              id="diagnostic-start-lesson-button"
              onClick={() => router.push(`/activity?goalId=${report.learningGoalId}`)}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-medium text-xs sm:text-sm text-[#07090e] bg-white hover:bg-slate-200 transition-all tracking-wide shadow-lg flex items-center justify-center gap-2"
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
        <div className="space-y-8 animate-fade-in">
          {/* Subtle Progress Indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span>
                Question {currentIndex + 1} of {items.length}
              </span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-0.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Question Prompt */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              {currentItem.competencyId.replace(/^[a-z]+-/, "").replace(/-/g, " ")}
            </div>
            <h2 className="text-lg sm:text-xl font-light text-white leading-relaxed">
              {currentItem.prompt}
            </h2>
          </div>

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
            ) : (
              <input
                type="text"
                placeholder="Type your answer here..."
                value={currentAnswer}
                onChange={(e) => handleSelectAnswer(e.target.value)}
                className="w-full bg-[#0c1018] border border-white/[0.08] focus:border-white/30 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            )}
          </div>

          {/* Advance or Submit Action */}
          <div className="pt-4 flex items-center justify-between">
            {currentIndex > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                ← Previous
              </button>
            ) : <div />}

            <button
              id="diagnostic-next-button"
              type="button"
              disabled={submitting || !currentAnswer}
              onClick={handleNextOrFinish}
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#07090e] bg-white hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {submitting
                ? "Calibrating..."
                : currentIndex === items.length - 1
                ? "Complete diagnostic →"
                : "Next question →"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DiagnosticPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-[#f6f3eb] flex flex-col font-sans selection:bg-white/20 selection:text-white antialiased">
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
