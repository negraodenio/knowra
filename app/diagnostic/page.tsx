"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const goalIdParam = searchParams.get("goalId");

  const { userId, activeGoalId, goals, refreshGoals } = useLearner();
  const effectiveGoalId = goalIdParam || activeGoalId || (goals.length > 0 ? goals[0].id : null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const startDiagnosticSession = useCallback(async () => {
    if (!effectiveGoalId) return;
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [effectiveGoalId, userId]);

  useEffect(() => {
    if (effectiveGoalId && !sessionId && !report) {
      startDiagnosticSession();
    }
  }, [effectiveGoalId, sessionId, report, startDiagnosticSession]);

  const handleSelectAnswer = (ans: string) => {
    const currentItem = items[currentIndex];
    if (!currentItem) return;
    setAnswers((prev) => ({ ...prev, [currentItem.id]: ans }));
  };

  const handleNextOrFinish = async () => {
    if (!sessionId) return;
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
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">No Learning Goal Selected</h2>
        <p className="text-sm text-slate-400">
          Create a goal first so Knowra can calibrate your personalized diagnostic.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl font-semibold text-xs bg-sky-500 text-white"
        >
          Create Goal →
        </Link>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const progressPercent = items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Starting Diagnostic Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
            Diagnostic Assessment
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-xs text-slate-400">Calibrating Initial Knowledge State</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Find Your Starting Point
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Answer each question to the best of your ability. Knowra measures baseline competency without penalizing mistakes.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Preparing diagnostic questions for your domain...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-rose-800 bg-rose-950/20 text-rose-300 space-y-3">
          <div className="font-semibold text-sm">Diagnostic Error</div>
          <p className="text-xs">{error}</p>
          <button
            onClick={() => startDiagnosticSession()}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Retry Diagnostic
          </button>
        </div>
      ) : report ? (
        /* ==========================================================
           DIAGNOSTIC REPORT SUMMARY (§9)
           ========================================================== */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2 pb-6 border-b border-slate-800">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              ✓ Diagnostic Complete
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Your Starting Point
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your baseline scores are now permanently established in the Learning Engine. Subsequent practice will measure progress against this baseline.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around p-6 rounded-xl border border-slate-800 bg-slate-950 gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Baseline Score
              </div>
              <div className="text-4xl font-extrabold font-mono text-white mt-1">
                {report.overallBaselineScore.toFixed(0)}%
              </div>
            </div>

            <div className="h-10 w-px bg-slate-800 hidden sm:block" />

            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Status
              </div>
              <div className="text-sm font-semibold text-emerald-400 mt-1">
                Starting Point Established
              </div>
            </div>
          </div>

          {/* Relative Strengths */}
          {report.relativeStrengths.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Relative Strengths
              </div>
              <ul className="space-y-1.5">
                {report.relativeStrengths.map((str, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-300 flex items-start gap-2 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-lg"
                  >
                    <span className="text-emerald-400">✓</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lower Baselines / Areas to Strengthen */}
          {report.lowerBaselines.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Recommended Focus Areas
              </div>
              <ul className="space-y-1.5">
                {report.lowerBaselines.map((low, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-300 flex items-start gap-2 bg-amber-950/20 border border-amber-900/30 p-2.5 rounded-lg"
                  >
                    <span className="text-amber-400">⚡</span>
                    <span>{low}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps CTAs */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="flex-1 py-3 text-center rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25 transition-all"
            >
              See Your Next Best Action →
            </Link>
            <Link
              href="/map"
              className="flex-1 py-3 text-center rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors"
            >
              Explore Learning Map
            </Link>
          </div>
        </div>
      ) : currentItem ? (
        /* ==========================================================
           DIAGNOSTIC QUESTION CARD (§9)
           ========================================================== */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Question {currentIndex + 1} of {items.length}
              </span>
              <span className="font-mono">{progressPercent.toFixed(0)}% Complete</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Question Prompt */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
              Topic: {currentItem.competencyId.replace(/^[a-z]+-/, "").replace(/-/g, " ")}
            </div>
            <div className="text-base sm:text-lg font-semibold text-white whitespace-pre-wrap leading-relaxed">
              {currentItem.prompt}
            </div>
          </div>

          {/* Answer Interaction */}
          <div className="space-y-2.5 pt-2">
            {currentItem.options ? (
              <div className="space-y-2">
                {currentItem.options.map((opt, optIdx) => {
                  const isSelected = answers[currentItem.id] === opt;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(opt)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-sky-500 bg-sky-500/10 text-sky-300 ring-1 ring-sky-500"
                          : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60"
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && <span className="text-sky-400 font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Enter your answer..."
                  value={answers[currentItem.id] || ""}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>
            )}
          </div>

          {/* Bottom Action */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-800/80">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="text-xs font-medium text-slate-500 hover:text-slate-300 disabled:opacity-30"
            >
              ← Previous
            </button>

            <button
              type="button"
              disabled={submitting || !answers[currentItem.id]}
              onClick={handleNextOrFinish}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 transition-colors"
            >
              {submitting
                ? "Submitting Diagnostic..."
                : currentIndex === items.length - 1
                ? "Submit & Calculate Baseline"
                : "Next Question →"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DiagnosticPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LearnerNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="text-slate-400 text-xs">Loading diagnostic...</div>}>
          <DiagnosticContent />
        </Suspense>
      </main>
    </div>
  );
}
