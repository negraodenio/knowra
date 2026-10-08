"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnerNav } from "./components/learner-nav";
import { useLearner } from "./lib/use-learner";
import { GapAlert, GapData } from "./components/ui/gap-alert";
import { LandingPage } from "./components/landing-page";
import { AuthModal } from "./components/auth-modal";

interface RecommendationData {
  id: string;
  action: "LEARN" | "PRACTICE" | "FEYNMAN" | "REVIEW" | "REMEDIATE" | "RETRY" | "ADVANCE";
  competencyId: string;
  competencyTitle?: string;
  priority: number;
  reason: string;
  estimatedMinutes: number;
  status: string;
}

interface LearningStateData {
  overallBaselineScore: number;
  diagnosticCompleted: boolean;
  competencies: Array<{
    competencyId: string;
    baselineScore: number;
    masteryScore: number;
    masteryState: string;
    confidence: number;
    evidenceCount: number;
  }>;
}

interface PlanItem {
  competencyId: string;
  title: string;
  action: string;
  reason: string;
  priority: number;
  estimatedMinutes: number;
  unblocked: boolean;
}

export default function LearnerDashboardPage() {
  const router = useRouter();
  const { userId, activeGoal, refreshGoals, loading: learnerLoading, isAuthenticated } = useLearner();

  // Onboarding Goal Form State
  const [rawObjective, setRawObjective] = useState("I want to become proficient in Python.");
  const [selectedDomain, setSelectedDomain] = useState("python-junior");
  const [selfReportedLevel, setSelfReportedLevel] = useState("Beginner");
  const [submittingGoal, setSubmittingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  // Auth modal state for landing conversions
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_UP");

  // Active Goal Dashboard State
  const [recommendation, setRecommendation] = useState<RecommendationData | null>(null);
  const [learningState, setLearningState] = useState<LearningStateData | null>(null);
  const [gaps, setGaps] = useState<GapData[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (goalId: string) => {
    if (!userId) return;
    setLoadingDashboard(true);
    setActionMessage(null);
    try {
      // 1. Fetch Recommendation
      const recRes = await fetch(`/api/learning/recommendation?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (recRes.ok) {
        const data = await recRes.json();
        setRecommendation(data.recommendation);
      }

      // 2. Fetch Learning State
      const stateRes = await fetch(`/api/learning/state?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setLearningState(stateData);
      }

      // 3. Fetch Gaps
      const gapsRes = await fetch(`/api/learning/gaps?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (gapsRes.ok) {
        const gapsData = await gapsRes.json();
        setGaps(gapsData.gaps || []);
      }

      // 4. Fetch Adaptive Plan
      const planRes = await fetch(`/api/learning/plan?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      if (planRes.ok) {
        const planData = await planRes.json();
        setPlanItems(planData.plan?.items || []);
      }
    } catch {
      // Best-effort load
    } finally {
      setLoadingDashboard(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeGoal) {
      loadDashboardData(activeGoal.id);
    }
  }, [activeGoal, loadDashboardData]);

  // Handle Goal Creation
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmittingGoal(true);
    setGoalError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          rawObjective,
          selectedDomainId: selectedDomain,
          selfReportedLevel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create goal");
      }

      const { goal } = await res.json();
      await refreshGoals();
      // Prompt user to take diagnostic
      router.push(`/diagnostic?goalId=${goal.id}`);
    } catch (err: unknown) {
      setGoalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingGoal(false);
    }
  };

  // Handle Recommendation Accept
  const handleAcceptRecommendation = async () => {
    if (!recommendation || !userId) return;
    try {
      const res = await fetch(`/api/learning/recommendation/${recommendation.id}/accept`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      if (res.ok) {
        setActionMessage("Action accepted. Let's begin the exercise!");
        setTimeout(() => {
          router.push(`/activity?goalId=${activeGoal?.id}&competencyId=${recommendation.competencyId}&action=${recommendation.action}`);
        }, 600);
      }
    } catch {
      // Ignored
    }
  };

  // Handle Recommendation Skip
  const handleSkipRecommendation = async () => {
    if (!recommendation || !userId) return;
    try {
      const res = await fetch(`/api/learning/recommendation/${recommendation.id}/skip`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      if (res.ok) {
        setActionMessage("Recommendation skipped. Fetching alternative action...");
        if (activeGoal) {
          loadDashboardData(activeGoal.id);
        }
      }
    } catch {
      // Ignored
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
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
      case "RETRY":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "ADVANCE":
        return "bg-teal-500/10 text-teal-400 border-teal-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  // Calculate Overall Demonstrated Mastery
  const comps = learningState?.competencies || [];
  const avgMastery =
    comps.length > 0
      ? comps.reduce((acc, c) => acc + c.masteryScore, 0) / comps.length
      : 0;
  const totalEvidenceCount = comps.reduce((acc, c) => acc + c.evidenceCount, 0);

  // Loading state (only for authenticated session setup)
  if (learnerLoading && userId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Connecting to Learning Engine...</p>
      </div>
    );
  }

  // CASE A: Anonymous visitor -> PUBLIC LANDING PAGE (§3, §4, §31)
  if (!isAuthenticated || !userId) {
    return (
      <>
        <LandingPage
          onStartLearning={() => {
            setAuthModalMode("SIGN_UP");
            setShowAuthModal(true);
          }}
          onSignIn={() => {
            setAuthModalMode("SIGN_IN");
            setShowAuthModal(true);
          }}
        />
        <AuthModal
          isOpen={showAuthModal}
          initialMode={authModalMode}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LearnerNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!activeGoal ? (
          /* ==========================================================
             ONBOARDING / GOAL ENTRY SCREEN (§7.1, §7.2, §8)
             ========================================================== */
          <div className="max-w-3xl mx-auto py-8">
            <div className="text-center space-y-3 mb-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                ✨ Adaptive Learning Journey
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Tell Knowra what you want to learn.
              </h1>
              <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
                Knowra maps your competency graph, identifies your exact starting point with a diagnostic, and recommends your Next Best Action.
              </p>
            </div>

            <form
              onSubmit={handleCreateGoal}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6"
            >
              {goalError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {goalError}
                </div>
              )}

              {/* Natural Objective Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  What is your learning goal?
                </label>
                <input
                  type="text"
                  required
                  value={rawObjective}
                  onChange={(e) => setRawObjective(e.target.value)}
                  placeholder="e.g. I want to become proficient in Python programming"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                />
                <p className="text-[11px] text-slate-500">
                  State your objective naturally — Knowra normalizes your intent into a competency path.
                </p>
              </div>

              {/* Curated Domain Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Select Curated Learning Domain
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "python-junior",
                      name: "Python Junior",
                      desc: "Variables, control flow, functions & data structures",
                      badge: "Curated Spine",
                    },
                    {
                      id: "math-exams",
                      name: "Mathematics",
                      desc: "Algebra, linear systems, functions & graphing",
                      badge: "Curated Spine",
                    },
                    {
                      id: "excel-pro",
                      name: "Excel Pro",
                      desc: "Formulas, XLOOKUP, conditional math & aggregation",
                      badge: "Curated Spine",
                    },
                  ].map((dom) => (
                    <button
                      type="button"
                      key={dom.id}
                      onClick={() => setSelectedDomain(dom.id)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        selectedDomain === dom.id
                          ? "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm text-white">{dom.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {dom.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{dom.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Self-Reported Experience Level */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Self-Reported Experience
                </label>
                <div className="flex gap-3">
                  {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setSelfReportedLevel(lvl)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        selfReportedLevel === lvl
                          ? "border-sky-500 bg-sky-500/10 text-sky-400"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingGoal}
                className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50"
              >
                {submittingGoal ? "Setting Up Learning Map..." : "Begin Adaptive Journey →"}
              </button>
            </form>
          </div>
        ) : (
          /* ==========================================================
             ACTIVE LEARNER DASHBOARD (§11, §12)
             ========================================================== */
          <div className="space-y-8">
            {/* Header Greeting & Goal Context */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                    Adaptive Workspace
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-400">Learner ID: {userId}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {activeGoal.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {!learningState?.diagnosticCompleted && (
                  <Link
                    href={`/diagnostic?goalId=${activeGoal.id}`}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                  >
                    ⚠️ Take Starting Diagnostic
                  </Link>
                )}
                <Link
                  href="/map"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/60 transition-colors"
                >
                  🗺️ View Learning Map
                </Link>
              </div>
            </div>

            {/* Quick Stats Overview (§17) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Baseline Diagnostic
                </div>
                <div className="mt-1 text-2xl font-bold font-mono text-white">
                  {learningState?.diagnosticCompleted
                    ? `${learningState.overallBaselineScore.toFixed(0)}%`
                    : "Not Taken"}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Immutable starting point</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Current Mastery
                </div>
                <div className="mt-1 text-2xl font-bold font-mono text-emerald-400">
                  {avgMastery > 0 ? `${avgMastery.toFixed(0)}%` : "0%"}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Across active competencies</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Verified Evidence
                </div>
                <div className="mt-1 text-2xl font-bold font-mono text-sky-400">
                  {totalEvidenceCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Demonstrated learning proofs</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Pedagogical Gaps
                </div>
                <div className="mt-1 text-2xl font-bold font-mono text-amber-400">
                  {gaps.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Areas requiring attention</div>
              </div>
            </div>

            {/* Action Alert Banner */}
            {actionMessage && (
              <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between">
                <span>{actionMessage}</span>
                <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            )}

            {/* ==========================================================
                THE VISUAL CENTER: NEXT BEST ACTION CARD (§11, §12)
                ========================================================== */}
            <div className="rounded-2xl border-2 border-sky-500/40 bg-gradient-to-b from-sky-950/20 via-slate-900/60 to-slate-900/80 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                    Recommended Action
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                </div>

                {recommendation && (
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${getActionBadgeColor(
                      recommendation.action
                    )}`}
                  >
                    {recommendation.action}
                  </span>
                )}
              </div>

              {loadingDashboard ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs">Evaluating learner state and DAG prerequisites...</p>
                </div>
              ) : recommendation ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {recommendation.competencyTitle || recommendation.competencyId}
                    </h2>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                      <span>⏱️ Est. Time: {recommendation.estimatedMinutes} mins</span>
                      <span>•</span>
                      <span>Priority Weight: {recommendation.priority}/100</span>
                    </div>
                  </div>

                  {/* Why Rationale (§11) */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-1.5">
                    <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                      Why are you being asked to do this?
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {recommendation.reason}
                    </p>
                  </div>

                  {/* Action CTAs */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href={`/activity?goalId=${activeGoal.id}&competencyId=${recommendation.competencyId}&action=${recommendation.action}&recId=${recommendation.id}`}
                      className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2"
                    >
                      <span>Start Activity</span>
                      <span>→</span>
                    </Link>

                    <button
                      onClick={handleAcceptRecommendation}
                      className="px-4 py-3 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors"
                    >
                      Accept Action
                    </button>

                    <button
                      onClick={handleSkipRecommendation}
                      className="px-4 py-3 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Skip For Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-slate-400">
                    No active recommendation. Take your diagnostic or check your learning map.
                  </p>
                  <Link
                    href={`/diagnostic?goalId=${activeGoal.id}`}
                    className="inline-block px-4 py-2 rounded-lg text-xs font-semibold bg-sky-500 text-white"
                  >
                    Start Diagnostic
                  </Link>
                </div>
              )}
            </div>

            {/* Active Gaps Callout (§16) */}
            {gaps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Active Learning Gaps Needing Attention ({gaps.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Targeted by Remediation &amp; Practice
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gaps.map((gap) => (
                    <GapAlert key={gap.id} gap={gap} />
                  ))}
                </div>
              </div>
            )}

            {/* Adaptive Learning Plan Preview (§10, §11) */}
            {planItems.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Upcoming Adaptive Learning Path
                    </h3>
                    <p className="text-xs text-slate-400">
                      Dynamically reconstructed from prerequisite mastery and gap states.
                    </p>
                  </div>
                  <Link
                    href="/map"
                    className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                  >
                    View Full Graph →
                  </Link>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {planItems.slice(0, 5).map((item, idx) => (
                    <div
                      key={item.competencyId}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono font-semibold text-slate-400 flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-medium text-slate-200">{item.title}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-md">
                            {item.reason}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getActionBadgeColor(
                            item.action
                          )}`}
                        >
                          {item.action}
                        </span>
                        <Link
                          href={`/activity?goalId=${activeGoal.id}&competencyId=${item.competencyId}&action=${item.action}`}
                          className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                        >
                          Practice
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
