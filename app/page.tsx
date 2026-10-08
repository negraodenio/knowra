"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnerNav } from "./components/learner-nav";
import { useLearner } from "./lib/use-learner";
import { GapAlert, GapData } from "./components/ui/gap-alert";
import { LandingPage } from "./components/landing-page";
import { AuthModal } from "./components/auth-modal";
import { detectDomainFromObjective } from "@/lib/learning/domain-detection";

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

  // Free-text learning intention
  const [rawObjective, setRawObjective] = useState("");
  const [submittingGoal, setSubmittingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [unsupportedNotice, setUnsupportedNotice] = useState<string | null>(null);

  // Auth modal state for landing page conversions
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

  // Handle Free-Text Learning Goal Creation
  const handleFreeTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const trimmedObjective = rawObjective.trim();
    if (!trimmedObjective) return;

    setGoalError(null);
    setUnsupportedNotice(null);

    const detected = detectDomainFromObjective(trimmedObjective);
    if (!detected) {
      setUnsupportedNotice(
        "Knowra can start with Python, Mathematics or Excel today. More learning paths are coming. Please choose one of our curated paths below or refine your learning goal."
      );
      return;
    }

    setSubmittingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          rawObjective: trimmedObjective,
          selectedDomainId: detected.id,
          selfReportedLevel: "Beginner",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create goal");
      }

      const { goal } = await res.json();
      await refreshGoals();
      router.push(`/diagnostic?goalId=${goal.id}`);
    } catch (err: unknown) {
      setGoalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingGoal(false);
    }
  };

  // Handle Curated Path Card Selection
  const handleSelectCuratedPath = async (domainId: string, defaultObjective: string) => {
    if (!userId || submittingGoal) return;
    setSubmittingGoal(true);
    setGoalError(null);
    setUnsupportedNotice(null);

    const objective = rawObjective.trim() || defaultObjective;

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          rawObjective: objective,
          selectedDomainId: domainId,
          selfReportedLevel: "Beginner",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create curated goal");
      }

      const { goal } = await res.json();
      await refreshGoals();
      router.push(`/diagnostic?goalId=${goal.id}`);
    } catch (err: unknown) {
      setGoalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingGoal(false);
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
    comps.length > 0 ? comps.reduce((acc, c) => acc + c.masteryScore, 0) / comps.length : 0;

  // Loading state (only for initial session verification)
  if (learnerLoading && userId) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center space-y-3 font-sans selection:bg-white/20 selection:text-white">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">Loading Knowra...</p>
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

  // CASE B: Authenticated Learner -> RESTORED LEARNING HOME (§3, §4, §5)
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-white/20 selection:text-white antialiased">
      <LearnerNav />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
        {/* ==========================================================
            RESUME ACTIVE JOURNEY BANNER (When learner has an active goal)
            ========================================================== */}
        {activeGoal && (
          <section className="rounded-2xl border border-white/[0.08] bg-[#0c1018] p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono tracking-[0.2em] text-slate-400 uppercase">
                  Active Learning Journey
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-300 font-medium">{activeGoal.title}</span>
              </div>

              <div className="flex items-center gap-2">
                {!learningState?.diagnosticCompleted ? (
                  <Link
                    href={`/diagnostic?goalId=${activeGoal.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                  >
                    ⚠️ Diagnostic Pending
                  </Link>
                ) : (
                  <Link
                    href="/map"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] transition-colors"
                  >
                    View Map →
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-white/[0.04] bg-[#07090e]">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Baseline Diagnostic
                </div>
                <div className="text-lg font-bold font-mono text-white mt-1">
                  {learningState?.diagnosticCompleted
                    ? `${learningState.overallBaselineScore.toFixed(0)}%`
                    : "Not Started"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-white/[0.04] bg-[#07090e]">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Demonstrated Mastery
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  {avgMastery > 0 ? `${avgMastery.toFixed(0)}%` : "0%"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-white/[0.04] bg-[#07090e] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Next Action
                    </span>
                    <div className="flex items-center gap-1.5">
                      {loadingDashboard && (
                        <div className="w-2.5 h-2.5 border border-white/20 border-t-white rounded-full animate-spin" />
                      )}
                      {recommendation && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getActionBadgeColor(
                            recommendation.action
                          )}`}
                        >
                          {recommendation.action}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-200 mt-1 truncate">
                    {recommendation?.competencyTitle ||
                      (!learningState?.diagnosticCompleted ? "Calibrate baseline" : "Adaptive review")}
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  {!learningState?.diagnosticCompleted ? (
                    <Link
                      href={`/diagnostic?goalId=${activeGoal.id}`}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
                    >
                      Start diagnostic →
                    </Link>
                  ) : recommendation ? (
                    <Link
                      href={`/activity?goalId=${activeGoal.id}&competencyId=${recommendation.competencyId}&action=${recommendation.action}&recId=${recommendation.id}`}
                      className="text-xs text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1"
                    >
                      Continue practice →
                    </Link>
                  ) : (
                    <Link
                      href="/map"
                      className="text-xs text-slate-400 hover:text-white font-medium inline-flex items-center gap-1"
                    >
                      Browse competencies →
                    </Link>
                  )}
                  {planItems.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {planItems.length} in plan
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==========================================================
            SOVEREIGN HOME HERO — "WHAT DO YOU WANT TO LEARN?" (§3, §4, §5)
            ========================================================== */}
        <section className="space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-[0.2em] uppercase bg-white/[0.04] text-slate-400 border border-white/[0.08]">
              <span>Adaptive Calibration</span>
              <span className="text-slate-600">/</span>
              <span>Intention Entry</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-light tracking-tight text-white font-serif">
              What do you want to learn?
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
              Tell Knowra what you want to learn in plain language, or choose a curated path below.
              Our engine calibrates your baseline and guides you through prerequisite mastery.
            </p>
          </div>

          {/* Primary Free-Text Goal Intake Form */}
          <form onSubmit={handleFreeTextSubmit} className="space-y-4">
            <div className="relative rounded-2xl border border-white/[0.1] bg-[#0c1018] p-2 sm:p-3 shadow-2xl focus-within:border-white/30 focus-within:ring-1 focus-within:ring-white/20 transition-all">
              <textarea
                id="home-learning-objective-input"
                rows={3}
                value={rawObjective}
                onChange={(e) => {
                  setRawObjective(e.target.value);
                  if (unsupportedNotice) setUnsupportedNotice(null);
                  if (goalError) setGoalError(null);
                }}
                placeholder={
                  "e.g. I want to learn Python for my first developer job\nI want to improve mathematics for an exam\nI want to master Excel for financial analysis"
                }
                className="w-full bg-transparent px-4 py-3 text-sm sm:text-base text-white placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 px-3 pb-1 border-t border-white/[0.04]">
                <div className="text-[11px] text-slate-500">
                  State your intention naturally. Knowra maps prerequisites automatically.
                </div>

                <button
                  id="home-start-learning-button"
                  type="submit"
                  disabled={submittingGoal || !rawObjective.trim()}
                  className="px-6 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-[#07090e] bg-white hover:bg-slate-200 transition-all tracking-wide disabled:opacity-40 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {submittingGoal ? "Setting Up Path..." : "Start learning →"}
                </button>
              </div>
            </div>

            {/* Honest Feedback for Non-MVP Disciplines (§6) */}
            {unsupportedNotice && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 leading-relaxed space-y-1">
                <div className="font-semibold text-amber-200 flex items-center gap-2">
                  <span>ℹ️</span> Curated Calibration Notice
                </div>
                <p>{unsupportedNotice}</p>
              </div>
            )}

            {/* Error Feedback */}
            {goalError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                {goalError}
              </div>
            )}
          </form>
        </section>

        {/* ==========================================================
            CURATED LEARNING PATHS (§4, §7)
            ========================================================== */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px bg-white/[0.08] flex-1" />
            <span className="text-xs font-mono tracking-widest text-slate-500 uppercase">
              or explore a path
            </span>
            <div className="h-px bg-white/[0.08] flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Card 1: Python */}
            <div
              id="curated-path-python"
              onClick={() =>
                handleSelectCuratedPath(
                  "python-junior",
                  "I want to learn Python from beginner to junior developer"
                )
              }
              className="group cursor-pointer rounded-2xl border border-white/[0.08] bg-[#0c1018] hover:border-white/30 hover:bg-[#0f141f] p-6 transition-all duration-200 shadow-xl flex flex-col justify-between space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-sky-400 uppercase bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20">
                    Curated Path
                  </span>
                  <span className="text-slate-500 text-xs font-mono">01</span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-sky-300 transition-colors">
                  Python
                </h3>
                <p className="text-xs font-medium text-slate-300">
                  From beginner to junior
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Variables, control flow, functions, modular architecture, and fundamental software engineering principles.
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 group-hover:text-white transition-colors">
                <span>Start Python Path</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Card 2: Mathematics */}
            <div
              id="curated-path-mathematics"
              onClick={() =>
                handleSelectCuratedPath(
                  "math-exams",
                  "I want to master Mathematics for exams and problem solving"
                )
              }
              className="group cursor-pointer rounded-2xl border border-white/[0.08] bg-[#0c1018] hover:border-white/30 hover:bg-[#0f141f] p-6 transition-all duration-200 shadow-xl flex flex-col justify-between space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    Curated Path
                  </span>
                  <span className="text-slate-500 text-xs font-mono">02</span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Mathematics
                </h3>
                <p className="text-xs font-medium text-slate-300">
                  Exams &amp; problem solving
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Algebraic expressions, linear &amp; quadratic equations, functions, coordinate geometry, and applied problem solving.
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 group-hover:text-white transition-colors">
                <span>Start Mathematics Path</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Card 3: Excel */}
            <div
              id="curated-path-excel"
              onClick={() =>
                handleSelectCuratedPath(
                  "excel-pro",
                  "I want to achieve professional mastery in Excel and spreadsheets"
                )
              }
              className="group cursor-pointer rounded-2xl border border-white/[0.08] bg-[#0c1018] hover:border-white/30 hover:bg-[#0f141f] p-6 transition-all duration-200 shadow-xl flex flex-col justify-between space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                    Curated Path
                  </span>
                  <span className="text-slate-500 text-xs font-mono">03</span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Excel
                </h3>
                <p className="text-xs font-medium text-slate-300">
                  Professional mastery
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Advanced formulas, XLOOKUP, Pivot Tables, conditional logic, financial models, and executive data preparation.
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 group-hover:text-white transition-colors">
                <span>Start Excel Path</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================================
            ACTIVE GAPS CALLOUT (If gaps exist for the active journey)
            ========================================================== */}
        {activeGoal && gaps.length > 0 && (
          <section className="space-y-4 pt-6 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Identified Knowledge Gaps ({gaps.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Targeted by remediation and active practice exercises.
                </p>
              </div>
              <Link
                href="/map"
                className="text-xs text-sky-400 hover:text-sky-300 font-medium"
              >
                View in graph →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gaps.map((gap) => (
                <GapAlert key={gap.id} gap={gap} />
              ))}
            </div>
          </section>
        )}

        {/* Action toast message */}
        {actionMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-sky-500/30 bg-[#0c1018] text-sky-300 text-xs shadow-2xl animate-fade-in flex items-center gap-2">
            <span>✨</span>
            <span>{actionMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}
