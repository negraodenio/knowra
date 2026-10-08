"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";

interface ProductEventPayload {
  competencyId?: string;
  targetOutcome?: string;
  rawObjective?: string;
  overallBaselineScore?: number;
  score?: number;
  result?: string;
  masteryScore?: number;
  masteryState?: string;
  reason?: string;
  learningGain?: number;
  relativeGain?: number;
  action?: string;
  [key: string]: unknown;
}

interface ProductEvent {
  id: string;
  eventType: string;
  timestamp: string;
  payload: ProductEventPayload;
}

export default function HistoryPage() {
  const { userId, activeGoal } = useLearner();
  const [events, setEvents] = useState<ProductEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (goalId?: string) => {
    setLoading(true);
    try {
      const url = goalId
        ? `/api/learning/history?goalId=${goalId}`
        : "/api/learning/history";
      const res = await fetch(url, {
        headers: { "x-user-id": userId },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory(activeGoal?.id);
  }, [activeGoal, loadHistory]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case "goal_created":
        return { label: "Goal Created", color: "bg-sky-500/10 text-sky-400 border-sky-500/30", icon: "🎯" };
      case "diagnostic_completed":
        return { label: "Diagnostic Completed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: "📊" };
      case "activity_completed":
        return { label: "Activity Completed", color: "bg-teal-500/10 text-teal-400 border-teal-500/30", icon: "✓" };
      case "evidence_emitted":
        return { label: "Evidence Recorded", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30", icon: "📝" };
      case "mastery_changed":
        return { label: "Mastery Shift", color: "bg-purple-500/10 text-purple-400 border-purple-500/30", icon: "📈" };
      case "gap_detected":
        return { label: "Gap Identified", color: "bg-rose-500/10 text-rose-400 border-rose-500/30", icon: "⚠️" };
      case "assessment_completed":
        return { label: "Assessment Graded", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: "🎓" };
      case "learning_gain_recorded":
        return { label: "Learning Gain Recorded", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: "🚀" };
      default:
        return { label: type.replace(/_/g, " "), color: "bg-slate-800 text-slate-400 border-slate-700", icon: "•" };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LearnerNav />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Audit Trail
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">Learner: {userId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Learning Journey History
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified chronological timeline of all pedagogical interactions, evidence, and state shifts.
            </p>
          </div>

          <button
            onClick={() => loadHistory(activeGoal?.id)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Loading learner history events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
            <div className="text-2xl">📜</div>
            <h3 className="text-sm font-semibold text-white">No Learning Events Recorded Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your learning history updates automatically as you complete diagnostics, practice activities, and assessments.
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {events.map((ev) => {
              const badge = getEventBadge(ev.eventType);
              return (
                <div key={ev.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center text-[8px] text-slate-400 group-hover:border-sky-500 transition-colors">
                    {badge.icon}
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-2 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        {Boolean(ev.payload?.competencyId) && (
                          <span className="text-xs font-semibold text-white">
                            {String(ev.payload.competencyId)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Event Detail Summary */}
                    <div className="text-xs text-slate-300">
                      {ev.eventType === "goal_created" && (
                        <span>Created goal: <strong>{String(ev.payload.targetOutcome || ev.payload.rawObjective || "New Goal")}</strong></span>
                      )}
                      {ev.eventType === "diagnostic_completed" && (
                        <span>
                          Diagnostic finished with baseline: <strong>{typeof ev.payload.overallBaselineScore === "number" ? ev.payload.overallBaselineScore.toFixed(0) : "0"}%</strong>
                        </span>
                      )}
                      {ev.eventType === "evidence_emitted" && (
                        <span>
                          Produced evidence with score <strong>{ev.payload.score}%</strong> (Result: {String(ev.payload.result)})
                        </span>
                      )}
                      {ev.eventType === "mastery_changed" && (
                        <span>
                          Mastery updated to <strong>{typeof ev.payload.masteryScore === "number" ? ev.payload.masteryScore.toFixed(0) : "0"}%</strong> ({String(ev.payload.masteryState)})
                        </span>
                      )}
                      {ev.eventType === "gap_detected" && (
                        <span className="text-rose-300">
                          Gap detected: {String(ev.payload.reason)}
                        </span>
                      )}
                      {ev.eventType === "assessment_completed" && (
                        <span>
                          Final Assessment score: <strong>{typeof ev.payload.score === "number" ? ev.payload.score.toFixed(0) : "0"}%</strong>
                        </span>
                      )}
                      {ev.eventType === "learning_gain_recorded" && (
                        <span className="text-emerald-300 font-semibold">
                          Learning Gain: +{typeof ev.payload.learningGain === "number" ? ev.payload.learningGain.toFixed(1) : "0"} points
                        </span>
                      )}
                      {ev.eventType === "activity_completed" && (
                        <span>
                          Completed {String(ev.payload.action)} activity with score <strong>{ev.payload.score}%</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
