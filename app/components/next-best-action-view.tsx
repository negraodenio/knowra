"use client";

import { useCallback, useEffect, useState } from "react";
import { RecommendationEntity } from "@/lib/learning/types";
import { AdaptiveLearningPlan } from "@/lib/learning/learning-plan";

interface NextBestActionViewProps {
  goalId: string;
  userId?: string;
  onActionComplete?: () => void;
}

export function NextBestActionView({
  goalId,
  userId = "00000000-0000-0000-0000-000000000001",
  onActionComplete,
}: NextBestActionViewProps) {
  const [recommendation, setRecommendation] = useState<RecommendationEntity | null>(null);
  const [plan, setPlan] = useState<AdaptiveLearningPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  const fetchNextAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/learning/recommendation?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch recommendation");
      }
      const data = await res.json();
      setRecommendation(data.recommendation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [goalId, userId]);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/learning/plan?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
      }
    } catch {
      // Ignore background plan fetch errors
    }
  }, [goalId, userId]);

  useEffect(() => {
    if (goalId) {
      fetchNextAction();
      fetchPlan();
    }
  }, [goalId, fetchNextAction, fetchPlan]);


  const handleAccept = async () => {
    if (!recommendation) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/learning/recommendation/${recommendation.id}/accept`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to accept recommendation");
      }
      const data = await res.json();
      setRecommendation(data.recommendation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSkip = async () => {
    if (!recommendation) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/learning/recommendation/${recommendation.id}/skip`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to skip recommendation");
      }
      // Re-fetch next best action
      await fetchNextAction();
      await fetchPlan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(false);
    }
  };

  const handleComplete = async () => {
    if (!recommendation) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/learning/recommendation/${recommendation.id}/complete`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to complete recommendation");
      }
      if (onActionComplete) onActionComplete();
      await fetchNextAction();
      await fetchPlan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "REMEDIATE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "RETRY":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "REVIEW":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "PRACTICE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "FEYNMAN":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "LEARN":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      case "ADVANCE":
        return "bg-teal-500/10 text-teal-400 border-teal-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="border border-slate-800 bg-slate-900/90 rounded-2xl p-6 shadow-xl space-y-6 text-slate-200">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sprint 5: Adaptive Loop
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">Next Best Action</h2>
        </div>
        {recommendation && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide ${getActionBadgeColor(
              recommendation.action
            )}`}
          >
            {recommendation.action}
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-sm text-slate-400">
          Calculating Next Best Action deterministically...
        </div>
      )}

      {!loading && recommendation && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-4 gap-2">
            <div>
              <span className="text-xs text-slate-500 font-mono">Competency Target</span>
              <h3 className="text-base font-semibold text-white font-mono">
                {recommendation.competencyId}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Priority</span>
                <span className="font-semibold text-blue-400 font-mono">
                  {recommendation.priority.toFixed(1)} / 100
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Estimated Time</span>
                <span className="font-semibold text-emerald-400">
                  {recommendation.estimatedMinutes} min
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Status</span>
                <span className="font-mono text-slate-300">{recommendation.status}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              Why this action:
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
              {recommendation.reason}
            </p>
          </div>

          {/* Action lifecycle buttons */}
          <div className="flex items-center gap-3 pt-2">
            {recommendation.status === "PENDING" && (
              <>
                <button
                  onClick={handleAccept}
                  disabled={actionInProgress}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  Start Activity ({recommendation.action})
                </button>
                <button
                  onClick={handleSkip}
                  disabled={actionInProgress}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  Skip
                </button>
              </>
            )}

            {recommendation.status === "ACCEPTED" && (
              <div className="w-full flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                <span className="text-xs text-blue-300">
                  Recommendation accepted. Activity in progress.
                </span>
                <button
                  onClick={handleComplete}
                  disabled={actionInProgress}
                  className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Complete Activity
                </button>
              </div>
            )}

            {recommendation.status === "COMPLETED" && (
              <div className="w-full text-center text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                Activity completed! Fetching next action...
              </div>
            )}
          </div>

          {/* Dynamic Adaptive Plan Toggle */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setShowPlan(!showPlan)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
            >
              <span>{showPlan ? "Hide" : "View"} Adaptive Learning Plan</span>
              {plan && (
                <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px] text-slate-300">
                  {plan.steps.length} steps • {plan.totalEstimatedMinutes}m remaining
                </span>
              )}
            </button>

            {showPlan && plan && (
              <div className="mt-3 space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 flex justify-between pb-2 border-b border-slate-800">
                  <span>Goal: {plan.targetOutcome}</span>
                  <span>Completed: {plan.completedStepsCount} / {plan.steps.length}</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {plan.steps.map((s) => (
                    <div
                      key={s.stepNumber}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                        s.status === "ACTIVE"
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-200"
                          : s.status === "COMPLETED"
                          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300/80"
                          : "bg-slate-900/50 border-slate-800/60 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500 w-5">
                          #{s.stepNumber}
                        </span>
                        <span className="font-semibold">{s.competencyTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-slate-400">{s.action}</span>
                        {s.estimatedMinutes > 0 && <span>{s.estimatedMinutes}m</span>}
                        <span className="text-[10px] uppercase font-bold">{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
