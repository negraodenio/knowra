"use client";

import React, { useState } from "react";

interface CompetencyBaseline {
  competencyId: string;
  baselineScore: number;
  confidence: number;
  evidenceCount: number;
}

interface DiagnosticReport {
  overallBaselineScore: number;
  competencyBaselines: CompetencyBaseline[];
  relativeStrengths: string[];
  lowerBaselines: string[];
}

interface DiagnosticItem {
  id: string;
  prompt: string;
  itemType: string;
  difficulty: number;
  options?: string[];
}

export function DiagnosticFlow() {
  const [step, setStep] = useState<"SELECT_GOAL" | "RUNNING_DIAGNOSTIC" | "RESULTS">("SELECT_GOAL");
  const [selectedDomain, setSelectedDomain] = useState("python-junior");
  const [rawObjective, setRawObjective] = useState("I want to become a junior Python developer.");
  const [selfReportedLevel, setSelfReportedLevel] = useState("Beginner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const testUserId = "test-learner-1";

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create goal
      const goalRes = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": testUserId },
        body: JSON.stringify({
          rawObjective,
          selectedDomainId: selectedDomain,
          selfReportedLevel,
        }),
      });
      if (!goalRes.ok) throw new Error("Failed to create goal");
      const { goal } = await goalRes.json();

      // 2. Start diagnostic
      const diagRes = await fetch("/api/diagnostic/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": testUserId },
        body: JSON.stringify({ goalId: goal.id }),
      });
      if (!diagRes.ok) throw new Error("Failed to start diagnostic");
      const { session, items } = await diagRes.json();

      setSessionId(session.id);
      setItems(items);
      setStep("RUNNING_DIAGNOSTIC");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (itemId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: answer }));
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      // Submit each answer
      for (const item of items) {
        const ans = answers[item.id] || "";
        await fetch(`/api/diagnostic/${sessionId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": testUserId },
          body: JSON.stringify({ itemId: item.id, answer: ans }),
        });
      }

      // Complete diagnostic
      const compRes = await fetch(`/api/diagnostic/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": testUserId },
      });
      if (!compRes.ok) {
        const data = await compRes.json();
        throw new Error(data.error || "Failed to complete diagnostic");
      }

      const rep = await compRes.json();
      setReport(rep);
      setStep("RESULTS");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-6 mt-6 text-slate-200">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Sprint 3: Baseline Diagnostic Engine</h2>
          <p className="text-xs text-slate-400">Adaptive Baseline Measurement &amp; Initial Learning State</p>
        </div>
        <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
          Step: {step}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {step === "SELECT_GOAL" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Curated Domain</label>
            <select
              value={selectedDomain}
              onChange={(e) => {
                setSelectedDomain(e.target.value);
                if (e.target.value === "python-junior") setRawObjective("I want to become a junior Python developer.");
                else if (e.target.value === "math-exams") setRawObjective("I need to prepare for my mathematics exam.");
                else setRawObjective("I want to master Excel spreadsheets for professional analysis.");
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="python-junior">Python: Beginner to Junior Developer</option>
              <option value="math-exams">Mathematics for Exams</option>
              <option value="excel-pro">Excel &amp; Spreadsheets for Professionals</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Learning Goal / Objective</label>
            <input
              type="text"
              value={rawObjective}
              onChange={(e) => setRawObjective(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Self-Reported Experience Level</label>
            <select
              value={selfReportedLevel}
              onChange={(e) => setSelfReportedLevel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="Beginner">Beginner (No prior formal knowledge)</option>
              <option value="Intermediate">Intermediate (Basic practical experience)</option>
              <option value="Advanced">Advanced (Familiar with core concepts)</option>
            </select>
          </div>

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "Initializing..." : "Start Calibrated Diagnostic"}
          </button>
        </div>
      )}

      {step === "RUNNING_DIAGNOSTIC" && (
        <div className="space-y-6">
          <p className="text-xs text-slate-400">
            Answer the following calibrated items to establish your baseline evidence:
          </p>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id} className="border border-slate-800 bg-slate-950/60 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-blue-400">Question {idx + 1} of {items.length}</span>
                  <span className="text-xs text-slate-500">Difficulty: {item.difficulty}/5</span>
                </div>
                <p className="text-sm text-slate-200 mb-3 whitespace-pre-line">{item.prompt}</p>

                {item.options ? (
                  <div className="space-y-1.5">
                    {item.options.map((opt) => (
                      <label key={opt} className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`item-${item.id}`}
                          value={opt}
                          checked={answers[item.id] === opt}
                          onChange={() => handleAnswerChange(item.id, opt)}
                          className="text-blue-600 focus:ring-0"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                    placeholder="Type your response..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                  />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "Evaluating & Persisting Evidence..." : "Submit Diagnostic & Generate Baseline"}
          </button>
        </div>
      )}

      {step === "RESULTS" && report && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400 font-semibold">Overall Baseline Score</p>
              <p className="text-3xl font-bold text-white mt-1">{report.overallBaselineScore}%</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Baseline Preserved: <span className="text-emerald-400 font-medium">True</span></p>
              <p>Evidence Count: {report.competencyBaselines.length} competencies</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Competency Baseline Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.competencyBaselines.map((cb) => (
                <div key={cb.competencyId} className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
                  <div className="flex justify-between font-mono mb-1">
                    <span className="text-slate-300 font-semibold">{cb.competencyId}</span>
                    <span className={cb.baselineScore >= 75 ? "text-emerald-400" : "text-amber-400"}>
                      {cb.baselineScore}%
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Evidence Confidence:</span>
                    <span>{(cb.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Designating lower baselines without calling them gaps (§39) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <h4 className="font-semibold text-emerald-400 mb-1">Areas of Relative Strength</h4>
              {report.relativeStrengths.length > 0 ? (
                <ul className="list-disc list-inside text-slate-300">
                  {report.relativeStrengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400">No areas evaluated at strong baseline yet.</p>
              )}
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <h4 className="font-semibold text-amber-400 mb-1">Lower Baseline (Needs Further Assessment)</h4>
              {report.lowerBaselines.length > 0 ? (
                <ul className="list-disc list-inside text-slate-300">
                  {report.lowerBaselines.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400">All competencies demonstrated baseline competence.</p>
              )}
            </div>
          </div>

          <button
            onClick={() => setStep("SELECT_GOAL")}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition"
          >
            Start New Diagnostic
          </button>
        </div>
      )}
    </div>
  );
}
