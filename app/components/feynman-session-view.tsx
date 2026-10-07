"use client";

import { useEffect, useState } from "react";
import { FeynmanSessionEntity } from "@/lib/learning/state/feynman-service";

interface FeynmanSessionViewProps {
  goalId: string;
  competencyId: string;
  userId?: string;
  onEvaluationComplete?: () => void;
  onClose?: () => void;
}

export function FeynmanSessionView({
  goalId,
  competencyId,
  userId = "00000000-0000-0000-0000-000000000001",
  onEvaluationComplete,
  onClose,
}: FeynmanSessionViewProps) {
  const [session, setSession] = useState<FeynmanSessionEntity | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/learning/feynman/${competencyId}?goalId=${goalId}`, {
          headers: { "x-user-id": userId },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to start Feynman session.");
        }
        const data = await res.json();
        setSession(data.session);
        if (data.session.learnerExplanation) {
          setExplanation(data.session.learnerExplanation);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [competencyId, goalId, userId]);

  const handleSubmit = async () => {
    if (!session || !explanation.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/learning/feynman/${competencyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          sessionId: session.id,
          explanation: explanation.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Evaluation failed.");
      }

      const data = await res.json();
      setSession(data.session);
      if (onEvaluationComplete) onEvaluationComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-purple-500/30 bg-slate-900/90 rounded-2xl p-6 text-slate-300 text-sm text-center">
        Loading Feynman explanation prompt...
      </div>
    );
  }

  return (
    <div className="border border-purple-500/30 bg-slate-900/90 rounded-2xl p-6 shadow-xl space-y-5 text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
            Feynman Conceptual Verification
          </span>
          <h3 className="text-lg font-bold text-white font-mono">{competencyId}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
          >
            Close
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {session && (
        <div className="space-y-4">
          <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
            <span className="text-[11px] uppercase font-bold tracking-wider text-purple-300 block mb-1">
              Teaching Prompt
            </span>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">{session.prompt}</p>
          </div>

          {session.status !== "EVALUATED" ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-400">
                Your Explanation (in your own words, using simple analogies):
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={5}
                placeholder="Explain the concept simply: what it is, why it exists, and an intuitive example..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || explanation.trim().length < 15}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {submitting ? "Evaluating via Pedagogical Rubric..." : "Submit Explanation for Evaluation"}
              </button>
            </div>
          ) : (
            session.evaluation && (
              <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Rubric Overall Score</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      session.evaluation.overall_score >= 70 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {session.evaluation.overall_score} / 100
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-500 block">Correctness</span>
                    <span className="font-semibold text-slate-200">{session.evaluation.correctness}%</span>
                  </div>
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-500 block">Completeness</span>
                    <span className="font-semibold text-slate-200">{session.evaluation.completeness}%</span>
                  </div>
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-500 block">Simplicity</span>
                    <span className="font-semibold text-slate-200">{session.evaluation.simplicity}%</span>
                  </div>
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-500 block">Causal Logic</span>
                    <span className="font-semibold text-slate-200">{session.evaluation.causal_reasoning}%</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-purple-300 block">Pedagogical Feedback</span>
                  <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    {session.evaluation.feedback}
                  </p>
                </div>

                {session.evaluation.missing_concepts.length > 0 && (
                  <div className="text-xs text-amber-400">
                    <span className="font-semibold">Missing Elements: </span>
                    <span>{session.evaluation.missing_concepts.join(", ")}</span>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
