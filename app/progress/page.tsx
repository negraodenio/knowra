"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";

interface MeasurementReport {
  learningGoalId: string;
  domainId?: string;
  baseline: {
    score: number;
    establishedAt?: string;
  };
  final: {
    score: number;
    completedAt?: string;
  } | null;
  learningGain: number | null;
  relativeGain: number | null;
  retention?: {
    d7: { score: number; retentionRatio: number; gainRetained: number } | null;
    d30: { score: number; retentionRatio: number; gainRetained: number } | null;
  };
}

interface AssessmentItem {
  id: string;
  prompt: string;
  itemType: string;
  options?: string[];
}

interface EvidenceItem {
  id: string;
  competencyId: string;
  evidenceType: string;
  result: string;
  score: number;
  confidence: number;
  timestamp: string;
}

interface LearningStateSummary {
  overallBaselineScore: number;
  diagnosticCompleted: boolean;
}

export default function ProgressPage() {
  const { userId, activeGoal } = useLearner();

  const [measurement, setMeasurement] = useState<MeasurementReport | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [learningState, setLearningState] = useState<LearningStateSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Independent Assessment Modal/Test Flow State
  const [inAssessment, setInAssessment] = useState(false);
  const [assessmentSessionId, setAssessmentSessionId] = useState<string | null>(null);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([]);
  const [assessmentIndex, setAssessmentIndex] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string>>({});
  const [submittingAssessment, setSubmittingAssessment] = useState(false);

  const loadProgressData = useCallback(async (goalId: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Measurement Report
      const gainRes = await fetch(`/api/learning/gain/${goalId}?userId=${userId}`, {
        headers: { "x-user-id": userId },
      });
      if (gainRes.ok) {
        const gainData = await gainRes.json();
        setMeasurement(gainData);
      }

      // 2. Fetch Learning State
      const stateRes = await fetch(`/api/learning/state?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (stateRes.ok) {
        const sData = await stateRes.json();
        setLearningState(sData);
      }

      // 3. Fetch Evidence Ledger
      const histRes = await fetch(`/api/learning/history?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (histRes.ok) {
        const hData = await histRes.json();
        setEvidenceList(hData.evidence || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeGoal) {
      loadProgressData(activeGoal.id);
    }
  }, [activeGoal, loadProgressData]);

  // Start Independent Final Assessment
  const handleStartFinalAssessment = async () => {
    if (!activeGoal) return;
    setSubmittingAssessment(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          userId,
          learningGoalId: activeGoal.id,
          domainId: activeGoal.domainId,
          assessmentType: "FINAL",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start final assessment");
      }

      const data = await res.json();
      setAssessmentSessionId(data.session.id);
      setAssessmentItems(data.items || []);
      setAssessmentIndex(0);
      setAssessmentAnswers({});
      setInAssessment(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingAssessment(false);
    }
  };

  const handleAssessmentAnswer = (ans: string) => {
    const item = assessmentItems[assessmentIndex];
    if (item) {
      setAssessmentAnswers((prev) => ({ ...prev, [item.id]: ans }));
    }
  };

  const handleAssessmentNextOrSubmit = async () => {
    if (!assessmentSessionId) return;
    const currentItem = assessmentItems[assessmentIndex];
    const currentAns = assessmentAnswers[currentItem.id] || "";

    // Submit answer to server
    try {
      await fetch(`/api/learning/assessment/${assessmentSessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          userId,
          itemId: currentItem.id,
          answer: currentAns,
        }),
      });
    } catch {
      // Ignored
    }

    if (assessmentIndex < assessmentItems.length - 1) {
      setAssessmentIndex((prev) => prev + 1);
    } else {
      // Submit assessment
      setSubmittingAssessment(true);
      try {
        const submitRes = await fetch(`/api/learning/assessment/${assessmentSessionId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ userId }),
        });

        if (!submitRes.ok) {
          const err = await submitRes.json();
          throw new Error(err.error || "Failed to complete final assessment");
        }

        setInAssessment(false);
        if (activeGoal) {
          await loadProgressData(activeGoal.id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmittingAssessment(false);
      }
    }
  };

  if (!activeGoal) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <LearnerNav />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">No Learning Goal Selected</h2>
          <p className="text-sm text-slate-400">
            Create a learning goal to track learning gain, evidence records, and retention.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl font-semibold text-xs bg-sky-500 text-white"
          >
            Create Goal →
          </Link>
        </main>
      </div>
    );
  }

  const baselineScore =
    measurement?.baseline?.score ?? learningState?.overallBaselineScore ?? 0;
  const currentFinalScore = measurement?.final?.score;
  const learningGainVal = measurement?.learningGain;
  const relativeGainVal = measurement?.relativeGain;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LearnerNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Measurement &amp; Assessment Engine
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">{activeGoal.title}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Learning Gain &amp; Evidence
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Empirical proof of learning: Baseline Diagnostic vs Independent Final Assessment.
            </p>
          </div>

          {!inAssessment && (
            <button
              onClick={handleStartFinalAssessment}
              disabled={submittingAssessment}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
              <span>🎓 Take Final Assessment</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* IN-ASSESSMENT MODAL / TEST VIEW */}
        {inAssessment ? (
          <div className="max-w-3xl mx-auto rounded-2xl border-2 border-purple-500/40 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Independent Final Assessment
                </span>
                <h2 className="text-xl font-bold text-white">
                  Question {assessmentIndex + 1} of {assessmentItems.length}
                </h2>
              </div>
              <button
                onClick={() => setInAssessment(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Cancel
              </button>
            </div>

            {assessmentItems[assessmentIndex] && (
              <div className="space-y-4">
                <div className="text-base sm:text-lg font-semibold text-white whitespace-pre-wrap leading-relaxed">
                  {assessmentItems[assessmentIndex].prompt}
                </div>

                {assessmentItems[assessmentIndex].options ? (
                  <div className="space-y-2">
                    {assessmentItems[assessmentIndex].options?.map((opt, i) => {
                      const currentItem = assessmentItems[assessmentIndex];
                      const isSelected = assessmentAnswers[currentItem.id] === opt;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAssessmentAnswer(opt)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between ${
                            isSelected
                              ? "border-purple-500 bg-purple-500/20 text-purple-200 ring-1 ring-purple-500"
                              : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <span className="text-purple-400 font-bold">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Enter answer..."
                      value={assessmentAnswers[assessmentItems[assessmentIndex].id] || ""}
                      onChange={(e) => handleAssessmentAnswer(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between border-t border-slate-800">
                  <button
                    type="button"
                    disabled={assessmentIndex === 0}
                    onClick={() => setAssessmentIndex((prev) => Math.max(0, prev - 1))}
                    className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30"
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    disabled={submittingAssessment}
                    onClick={handleAssessmentNextOrSubmit}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                  >
                    {submittingAssessment
                      ? "Grading Assessment..."
                      : assessmentIndex === assessmentItems.length - 1
                      ? "Submit & Calculate Gain"
                      : "Next Question →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==========================================================
             PROGRESS & LEARNING GAIN DASHBOARD (§17, §18)
             ========================================================== */
          <div className="space-y-8">
            {/* The Learning Gain Measurement Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Baseline Card */}
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Baseline (Diagnostic)
                </div>
                <div className="text-4xl font-extrabold font-mono text-white">
                  {baselineScore.toFixed(0)}%
                </div>
                <p className="text-xs text-slate-500">
                  Initial calibrating measurement. Immutable starting anchor.
                </p>
              </div>

              {/* Final Assessment Card */}
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                  Independent Final Assessment
                </div>
                <div className="text-4xl font-extrabold font-mono text-purple-300">
                  {typeof currentFinalScore === "number" ? `${currentFinalScore.toFixed(0)}%` : "Pending"}
                </div>
                <p className="text-xs text-slate-500">
                  {typeof currentFinalScore === "number"
                    ? "Evaluated with non-overlapping independent items."
                    : "Take final assessment to measure absolute learning gain."}
                </p>
              </div>

              {/* Learning Gain Metric Card */}
              <div className="p-6 rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-slate-900/40 space-y-2">
                <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                  Empirical Learning Gain
                </div>
                <div className="text-4xl font-extrabold font-mono text-emerald-400">
                  {typeof learningGainVal === "number"
                    ? `${learningGainVal >= 0 ? "+" : ""}${learningGainVal.toFixed(1)} pts`
                    : "—"}
                </div>
                <div className="text-xs text-slate-400">
                  {typeof relativeGainVal === "number"
                    ? `Relative Gain (g): ${(relativeGainVal * 100).toFixed(1)}% of potential`
                    : "Gain calculated upon final assessment completion."}
                </div>
              </div>
            </div>

            {/* Retention Metrics (§19) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Long-Term Retention Measurement
                  </h3>
                  <p className="text-xs text-slate-400">
                    Retention measured at D7 and D30 post-intervention to assess durable knowledge.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-300">D7 Retention</div>
                    <div className="text-[11px] text-slate-500">7 days post final assessment</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-white">
                      {measurement?.retention?.d7 ? `${measurement.retention.d7.score.toFixed(0)}%` : "Not Due Yet"}
                    </div>
                    {measurement?.retention?.d7 && (
                      <div className="text-[10px] text-emerald-400">
                        {((measurement.retention.d7.retentionRatio || 1) * 100).toFixed(0)}% retained
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-300">D30 Retention</div>
                    <div className="text-[11px] text-slate-500">30 days post final assessment</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-white">
                      {measurement?.retention?.d30 ? `${measurement.retention.d30.score.toFixed(0)}%` : "Not Due Yet"}
                    </div>
                    {measurement?.retention?.d30 && (
                      <div className="text-[10px] text-emerald-400">
                        {((measurement.retention.d30.retentionRatio || 1) * 100).toFixed(0)}% retained
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Verified Evidence Ledger (§14) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Verified Evidence Ledger ({evidenceList.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Append-only ledger of verified learning proofs. Mastery is calculated strictly from this evidence.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading evidence proofs...</div>
              ) : evidenceList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No evidence recorded yet. Complete activities or diagnostic to produce verified evidence.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                        <th className="py-2.5 px-3 font-semibold">Competency</th>
                        <th className="py-2.5 px-3 font-semibold">Evidence Type</th>
                        <th className="py-2.5 px-3 font-semibold">Result</th>
                        <th className="py-2.5 px-3 font-semibold">Score</th>
                        <th className="py-2.5 px-3 font-semibold">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {evidenceList.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-xs text-white">
                            {ev.competencyId}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                              {ev.evidenceType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[11px] font-bold ${
                                ev.result === "SUCCESS"
                                  ? "text-emerald-400"
                                  : ev.result === "PARTIAL"
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {ev.result}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-white font-bold">{ev.score}%</td>
                          <td className="py-2.5 px-3 text-purple-400">
                            {(ev.confidence * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
