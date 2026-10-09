"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LearnerNav } from "./components/learner-nav";
import { useLearner } from "./lib/use-learner";
import { LandingPage } from "./components/landing-page";
import { AuthModal } from "./components/auth-modal";
import { detectDomainFromObjective } from "@/lib/learning/domain-detection";

interface PathPreviewData {
  goalId: string;
  goalTitle: string;
  domainName: string;
  description: string;
  competencies: Array<{
    id: string;
    title: string;
    category: string;
    difficulty?: number;
  }>;
  totalCompetencies: number;
}

const CURATED_TRACKS = [
  {
    id: "python-junior",
    number: "01",
    title: "Python Junior",
    subtitle: "From beginner to junior developer",
    objective: "I want to learn Python from beginner to junior developer",
  },
  {
    id: "math-exams",
    number: "02",
    title: "Mathematics for Exams",
    subtitle: "Algebra, equations, and problem solving",
    objective: "I want to master Mathematics for exams and problem solving",
  },
  {
    id: "excel-pro",
    number: "03",
    title: "Excel Pro",
    subtitle: "Formulas, data analysis, and financial modeling",
    objective: "I want to achieve professional mastery in Excel and spreadsheets",
  },
];

function formatDomainLabel(domainId: string): string {
  if (domainId === "python-junior") return "Python Junior";
  if (domainId === "math-exams") return "Mathematics for Exams";
  if (domainId === "excel-pro") return "Excel Pro";
  if (domainId.startsWith("dyn-")) {
    const clean = domainId.replace(/^dyn-/, "").replace(/-/g, " ");
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return "Adaptive Curriculum";
}

export default function LearnerHomePage() {
  const router = useRouter();
  const { userId, goals, refreshGoals, selectGoal, loading: learnerLoading, isAuthenticated } = useLearner();

  // Natural-language goal input
  const [rawObjective, setRawObjective] = useState("");
  const [selectedCuratedId, setSelectedCuratedId] = useState<string | null>(null);
  const [submittingGoal, setSubmittingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  // Path preview state (shown after explicit generation)
  const [pathPreview, setPathPreview] = useState<PathPreviewData | null>(null);

  // Auth modal state for unauthenticated conversions
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_UP");

  // Handle goal creation (natural language or curated)
  const handleCreatePath = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userId || submittingGoal) return;

    let objectiveToSubmit = rawObjective.trim();
    let domainIdToUse = "auto";

    if (!objectiveToSubmit && selectedCuratedId) {
      const match = CURATED_TRACKS.find((t) => t.id === selectedCuratedId);
      if (match) {
        objectiveToSubmit = match.objective;
        domainIdToUse = match.id;
      }
    } else if (objectiveToSubmit) {
      const detected = detectDomainFromObjective(objectiveToSubmit);
      if (detected) {
        domainIdToUse = detected.id;
      }
    }

    if (!objectiveToSubmit) return;

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
          rawObjective: objectiveToSubmit,
          selectedDomainId: domainIdToUse,
          selfReportedLevel: "Beginner",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate learning path");
      }

      const data = await res.json();
      await refreshGoals();
      await selectGoal(data.goal.id);

      // Present the Path Preview before diagnostic
      setPathPreview({
        goalId: data.goal.id,
        goalTitle: data.goal.title,
        domainName: data.preview?.domainName || formatDomainLabel(data.goal.domainId),
        description:
          data.preview?.description ||
          "Curriculum tailored to your stated intention and mapped into an acyclic prerequisite knowledge graph.",
        competencies: data.preview?.competencies || [],
        totalCompetencies: data.preview?.totalCompetencies || (data.preview?.competencies?.length ?? 0),
      });
    } catch (err: unknown) {
      setGoalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingGoal(false);
    }
  };

  const handleSelectCuratedTrack = (trackId: string) => {
    const track = CURATED_TRACKS.find((t) => t.id === trackId);
    if (!track) return;
    setSelectedCuratedId(trackId);
    setRawObjective(track.objective);
    setGoalError(null);
  };

  const handleResumeGoal = async (goalId: string) => {
    await selectGoal(goalId);
    router.push(`/activity?goalId=${goalId}`);
  };

  // Loading state during auth verification
  if (learnerLoading && userId) {
    return (
      <div className="min-h-screen bg-[#07090e] text-[#f6f3eb] flex flex-col items-center justify-center space-y-3 font-sans selection:bg-white/20 selection:text-white">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">Loading Knowra...</p>
      </div>
    );
  }

  // Anonymous visitor -> Public Landing Page
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

  // Authenticated Learner -> Calm, Minimal Guided Home
  return (
    <div className="min-h-screen bg-[#07090e] text-[#f6f3eb] flex flex-col font-sans selection:bg-white/20 selection:text-white antialiased">
      <LearnerNav />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col justify-center">
        {pathPreview ? (
          /* ==========================================================
             STEP 2: PATH PREVIEW (Calm, explicit curriculum preview)
             ========================================================== */
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase bg-white/[0.04] text-slate-400 border border-white/[0.08]">
                <span>Path Prepared</span>
                <span className="text-slate-600">•</span>
                <span className="text-white">{pathPreview.domainName}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white font-serif leading-tight">
                {pathPreview.goalTitle}
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
                {pathPreview.description}
              </p>
            </div>

            {/* Representative competencies list */}
            {pathPreview.competencies.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono uppercase tracking-wider">
                  <span>Representative Competencies</span>
                  <span>{pathPreview.totalCompetencies} in graph</span>
                </div>

                <div className="space-y-2">
                  {pathPreview.competencies.map((c) => (
                    <div
                      key={c.id}
                      className="px-4 py-3 rounded-xl border border-white/[0.06] bg-[#0c1018] flex items-center justify-between"
                    >
                      <span className="text-xs sm:text-sm text-slate-200 font-medium">
                        {c.title}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-slate-500 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                        {c.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single dominant CTA */}
            <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
              <button
                id="preview-start-diagnostic-button"
                onClick={() => router.push(`/diagnostic?goalId=${pathPreview.goalId}`)}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-medium text-xs sm:text-sm text-[#07090e] bg-white hover:bg-slate-200 transition-all tracking-wide shadow-lg flex items-center justify-center gap-2"
              >
                Start diagnostic →
              </button>

              <button
                type="button"
                onClick={() => setPathPreview(null)}
                className="text-xs text-slate-400 hover:text-white px-4 py-2 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        ) : (
          /* ==========================================================
             STEP 1: MINIMAL HOME — "WHAT DO YOU WANT TO LEARN?"
             ========================================================== */
          <div className="space-y-10">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl font-light tracking-tight text-white font-serif">
                What do you want to learn?
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-lg leading-relaxed">
                State your goal or pick a track to calibrate your baseline and start learning.
              </p>
            </div>

            {/* Single natural-language input & submit CTA */}
            <form onSubmit={handleCreatePath} className="space-y-3">
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c1018] p-3 sm:p-4 focus-within:border-white/25 transition-all space-y-3 shadow-xl">
                <textarea
                  id="home-learning-objective-input"
                  rows={2}
                  value={rawObjective}
                  onChange={(e) => {
                    setRawObjective(e.target.value);
                    setSelectedCuratedId(null);
                    if (goalError) setGoalError(null);
                  }}
                  placeholder="e.g. Learn Python for backend engineering, master Excel for finance, or study the Brazilian Cerrado..."
                  className="w-full bg-transparent px-2 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                />

                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-end">
                  <button
                    id="home-start-learning-button"
                    type="submit"
                    disabled={submittingGoal || (!rawObjective.trim() && !selectedCuratedId)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-[#07090e] bg-white hover:bg-slate-200 transition-all tracking-wide disabled:opacity-30 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {submittingGoal ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                        <span>Preparing path...</span>
                      </>
                    ) : (
                      "Create my learning path →"
                    )}
                  </button>
                </div>
              </div>

              {/* Error feedback with retry */}
              {goalError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between">
                  <span>{goalError}</span>
                  <button
                    type="button"
                    onClick={() => handleCreatePath()}
                    className="ml-3 px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}
            </form>

            {/* Three lightweight curated options */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
                Or choose a curated path
              </div>

              <div className="space-y-2">
                {CURATED_TRACKS.map((track) => {
                  const isSelected = selectedCuratedId === track.id;
                  return (
                    <button
                      key={track.id}
                      id={`curated-path-${track.id === "python-junior" ? "python" : track.id === "math-exams" ? "mathematics" : "excel"}`}
                      type="button"
                      onClick={() => handleSelectCuratedTrack(track.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-white/30 bg-white/[0.06] text-white"
                          : "border-white/[0.06] bg-[#0c1018]/60 text-slate-300 hover:border-white/15 hover:bg-[#0c1018]"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-xs font-mono text-slate-500">{track.number}</span>
                        <span className="text-xs sm:text-sm font-medium text-white">{track.title}</span>
                        <span className="text-xs text-slate-500 hidden sm:inline">• {track.subtitle}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400 pl-3">
                        {isSelected ? "Selected ✓" : "Select →"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Separate, compact "Continue learning" section */}
            {goals.length > 0 && (
              <section className="pt-6 border-t border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
                    Continue learning
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {goals.length} {goals.length === 1 ? "journey" : "journeys"}
                  </span>
                </div>

                <div className="space-y-2">
                  {goals.map((g) => (
                    <div
                      key={g.id}
                      className="px-4 py-3 rounded-xl border border-white/[0.06] bg-[#0c1018]/80 flex items-center justify-between hover:border-white/15 transition-all"
                    >
                      <div className="truncate mr-4">
                        <div className="text-xs sm:text-sm font-medium text-white truncate">{g.title}</div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-0.5">
                          {formatDomainLabel(g.domainId)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleResumeGoal(g.id)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] transition-colors whitespace-nowrap"
                      >
                        Resume →
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
