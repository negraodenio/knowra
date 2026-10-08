"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface LandingPageProps {
  onStartLearning: () => void;
  onSignIn: () => void;
}

export function LandingPage({ onStartLearning, onSignIn }: LandingPageProps) {
  const [activeVisualStep, setActiveVisualStep] = useState(3); // Default to Next Best Action card
  const [activePreviewTab, setActivePreviewTab] = useState<"nba" | "map" | "practice" | "progress">("nba");

  // Track landing_viewed on mount
  useEffect(() => {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "landing_viewed",
        payload: { path: "/", referrer: typeof document !== "undefined" ? document.referrer : "" },
      }),
    }).catch(() => {});
  }, []);

  const handleCtaClick = (location: string) => {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "landing_cta_clicked",
        payload: { location },
      }),
    }).catch(() => {});
    onStartLearning();
  };

  const handleHowItWorksClick = () => {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "landing_how_it_works_clicked",
        payload: { target: "#how-it-works" },
      }),
    }).catch(() => {});

    const el = document.getElementById("how-it-works");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500/30 selection:text-white">
      {/* ============================================================
          PUBLIC NAVBAR
          ============================================================ */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-sky-400 transition-colors">
                KNOWRA
              </span>
              <span className="text-[10px] text-slate-400 -mt-1 hidden sm:inline tracking-tight">
                Adaptive Learning Platform
              </span>
            </div>
          </Link>

          {/* Desktop Nav Anchors */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleHowItWorksClick(); }} className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#differentiation" className="hover:text-white transition-colors">
              Why Knowra
            </a>
            <a href="#curriculum" className="hover:text-white transition-colors">
              Curated Domains
            </a>
            <a href="#preview" className="hover:text-white transition-colors">
              Product Tour
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
            >
              Sign In
            </button>
            <button
              onClick={() => handleCtaClick("nav_header")}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all"
            >
              Start Learning →
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ============================================================
            HERO SECTION (§5, §6)
            ============================================================ */}
        <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-32 overflow-hidden border-b border-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/15 via-slate-950 to-slate-950 pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <span>✨</span>
                <span>The Adaptive Learning Engine</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                Learn what you need.<br />
                <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-slate-200 bg-clip-text text-transparent">
                  Not what everyone else gets.
                </span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
                Knowra understands what you already know, finds your learning gaps, and adapts what you should learn next.
              </p>

              {/* Core Supporting Thesis Line */}
              <div className="text-xs sm:text-sm font-mono text-sky-300/80 bg-slate-900/60 inline-block px-4 py-1.5 rounded-lg border border-slate-800">
                &ldquo;The Learning Engine knows what the learner knows.&rdquo;
              </div>

              {/* Hero CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => handleCtaClick("hero_primary")}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-xl shadow-sky-500/25 transition-all transform hover:-translate-y-0.5"
                >
                  Start Learning
                </button>
                <button
                  onClick={handleHowItWorksClick}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-900/80 hover:bg-slate-850 hover:text-white border border-slate-800 transition-colors"
                >
                  See How It Works
                </button>
              </div>
            </div>

            {/* ============================================================
                HERO PRODUCT VISUAL (§6)
                ============================================================ */}
            <div className="mt-14 sm:mt-18 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-4 sm:p-6 shadow-2xl relative">
                {/* Visual Flow Indicator */}
                <div className="flex items-center justify-between overflow-x-auto pb-4 mb-6 border-b border-slate-800/80 text-[11px] gap-2">
                  {[
                    { step: 1, label: "01 Goal", desc: "Intent Defined" },
                    { step: 2, label: "02 Diagnostic", desc: "Baseline Established" },
                    { step: 3, label: "03 Next Best Action", desc: "Highest Value Task" },
                    { step: 4, label: "04 Evidence", desc: "Proof Collected" },
                    { step: 5, label: "05 Mastery", desc: "State Updated" },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setActiveVisualStep(s.step)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                        activeVisualStep === s.step
                          ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                        activeVisualStep === s.step ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400"
                      }`}>
                        {s.step}
                      </span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>

                {/* Simulated Real Knowra Component States */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-5 sm:p-6">
                  {activeVisualStep === 1 && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono text-sky-400 uppercase">Learner Goal Intent</div>
                      <div className="text-lg font-bold text-white">&ldquo;I want to become proficient in Python programming.&rdquo;</div>
                      <div className="text-xs text-slate-400">
                        Normalized by Engine into curated domain <span className="font-mono text-emerald-400">python-junior</span>. 7 core competencies mapped into a directed prerequisite graph.
                      </div>
                    </div>
                  )}

                  {activeVisualStep === 2 && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono text-amber-400 uppercase">Diagnostic Starting Baseline</div>
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-white">Starting Point Established</div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Score: 57%
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Immutable starting baseline recorded. Verified prior knowledge is skipped; prerequisite weaknesses flagged for remediation.
                      </div>
                    </div>
                  )}

                  {activeVisualStep === 3 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider">
                            Engine Recommended Action
                          </span>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          PRACTICE
                        </span>
                      </div>
                      <div>
                        <div className="text-xl font-extrabold text-white">Variables &amp; Data Types</div>
                        <div className="text-xs text-slate-400 mt-1">Est. Time: 8 mins • Priority: 85/100</div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                        <span className="text-sky-400 font-semibold">Why this action: </span>
                        Your diagnostic indicated developing mastery (40%) in fundamental data types. Mastering this unblocks subsequent control flow.
                      </div>
                    </div>
                  )}

                  {activeVisualStep === 4 && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono text-sky-400 uppercase">Demonstrated Learning Evidence</div>
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-white">Activity: Expression Evaluation &amp; Type Casting</div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Score: 90%
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Verified evidence emitted. Bayesian learner state and confidence metrics update mathematically without guesswork.
                      </div>
                    </div>
                  )}

                  {activeVisualStep === 5 && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono text-emerald-400 uppercase">Mastery Updated</div>
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-white">Variables &amp; Types: Proficient (72%)</div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                          Gaps Resolved: 1
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Prerequisite met. The recommendation engine automatically recalculates and promotes <span className="font-mono text-white">Control Flow</span> as your next focus.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            PROBLEM SECTION (§7)
            ============================================================ */}
        <section className="py-20 border-b border-slate-900 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                The Missing Layer in Education
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Most learning platforms know what you did.<br />
                <span className="text-sky-400">Knowra focuses on what you know.</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Traditional courseware logs clicks and completion checkboxes. But watching a lecture does not prove competence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Traditional */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">📋</span>
                  <h3 className="text-base font-bold text-slate-200">What Traditional Systems Track</h3>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-600 mt-0.5">✕</span>
                    <span>What video lesson you opened or paused</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-600 mt-0.5">✕</span>
                    <span>How many minutes you were logged into the page</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-600 mt-0.5">✕</span>
                    <span>Linear completion percentages (e.g. &ldquo;60% finished&rdquo;)</span>
                  </li>
                </ul>
              </div>

              {/* What You Need */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  <h3 className="text-base font-bold text-white">What You Actually Need to Know</h3>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-200">
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-0.5">✓</span>
                    <span>What exact topics do I already understand?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-0.5">✓</span>
                    <span>Where are my prerequisite learning gaps?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-0.5">✓</span>
                    <span>What is the single most valuable action to take right now?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-0.5">✓</span>
                    <span>Can I demonstrate my knowledge under independent assessment?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-0.5">✓</span>
                    <span>Did I retain what I learned over weeks and months?</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            DIFFERENTIATION (§8)
            ============================================================ */}
        <section id="differentiation" className="py-20 border-b border-slate-900 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                True Adaptive Architecture
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Knowra is not another AI tutor.
              </h2>
              <p className="text-sm text-slate-400">
                A comparison of educational paradigms.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Traditional Course */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Traditional Course
                  </div>
                  <h3 className="text-lg font-bold text-slate-200">Same sequence for everyone.</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Rigid linear syllabus. Advanced learners are forced through basics they already know; struggling learners are pushed forward before prerequisites are mastered.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
                  Metric: Checkbox completion
                </div>
              </div>

              {/* AI Chatbot */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                    AI Chatbot / Prompt Wrapper
                  </div>
                  <h3 className="text-lg font-bold text-slate-200">Answers when you ask.</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Stateless conversation. The bot does not maintain an empirical learner state, does not evaluate prerequisite DAG dependencies, and cannot verify long-term memory.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
                  Metric: Message volume
                </div>
              </div>

              {/* Knowra */}
              <div className="rounded-2xl border-2 border-sky-500/50 bg-gradient-to-b from-sky-950/30 to-slate-900/80 p-6 flex flex-col justify-between space-y-4 shadow-xl shadow-sky-500/10">
                <div className="space-y-3">
                  <div className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Knowra Engine</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Adapts based on demonstrated evidence.</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Maintains an immutable baseline, maps competency dependencies, diagnoses starting gaps, and recommends the Next Best Action. Evaluates retention via modern spaced repetition.
                  </p>
                </div>
                <div className="pt-4 border-t border-sky-500/20 text-[11px] text-sky-400 font-mono">
                  Metric: Demonstrated mastery
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            HOW IT WORKS (§9)
            ============================================================ */}
        <section id="how-it-works" className="py-20 border-b border-slate-900 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                The 7-Stage Adaptive Loop
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                How Knowra Works
              </h2>
              <p className="text-sm text-slate-400">
                From initial goal to verified long-term retention.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Set Your Goal",
                  desc: "State what you want to learn in plain language. Knowra matches your goal to a structured competency map.",
                },
                {
                  step: "02",
                  title: "Discover Where You Are",
                  desc: "A brief starting diagnostic maps your prior knowledge. Topics you already know are credited; gaps are flagged.",
                },
                {
                  step: "03",
                  title: "See Your Learning Map",
                  desc: "Inspect your competency graph. See what is mastered, what is currently unblocked, and what requires attention.",
                },
                {
                  step: "04",
                  title: "Get Your Next Best Action",
                  desc: "Instead of choosing from dozens of modules, Knowra recommends the single highest-value exercise.",
                },
                {
                  step: "05",
                  title: "Produce Evidence",
                  desc: "Solve practical problems, explain concepts in your own words (Feynman), and complete spaced review cards.",
                },
                {
                  step: "06",
                  title: "Update Your Mastery",
                  desc: "Your mastery score and confidence update mathematically based on verified evidence, not time spent.",
                },
                {
                  step: "07",
                  title: "Adapt Continuously",
                  desc: "The moment your mastery shifts or a gap is resolved, the Next Best Action dynamically adapts.",
                },
                {
                  step: "08",
                  title: "Measure Learning Gain",
                  desc: "Independent post-assessments compare your final competence against baseline to verify genuine progress.",
                },
              ].map((item) => (
                <div key={item.step} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
                  <div className="text-xs font-mono font-bold text-sky-400">{item.step}</div>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            PRODUCT DEMONSTRATION (§10)
            ============================================================ */}
        <section id="demonstration" className="py-20 border-b border-slate-900 bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Concrete Execution
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Real Adaptive Learning in Action
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-mono">
                Example learner journey in Python Junior
              </p>
            </div>

            <div className="max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 space-y-6">
              {/* Step A: Goal */}
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                  A
                </span>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 font-mono">1. Goal Entry</div>
                  <div className="text-sm font-bold text-white">&ldquo;I want to become proficient in Python.&rdquo;</div>
                  <p className="text-xs text-slate-400">Target Domain: Python Junior (7 Core Competencies)</p>
                </div>
              </div>

              {/* Step B: Starting Point */}
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                  B
                </span>
                <div className="space-y-1.5 flex-1">
                  <div className="text-xs text-slate-400 font-mono">2. Diagnostic Baseline</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60">
                      <span className="font-semibold text-slate-200">Variables &amp; Types:</span>{" "}
                      <span className="text-amber-400 font-mono">Developing (40%)</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60">
                      <span className="font-semibold text-slate-200">Control Flow:</span>{" "}
                      <span className="text-rose-400 font-mono">Gap Detected</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step C: Recommendation */}
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                  C
                </span>
                <div className="space-y-2 flex-1">
                  <div className="text-xs text-slate-400 font-mono">3. Next Best Action</div>
                  <div className="p-4 rounded-xl border border-sky-500/30 bg-slate-950/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">Practice: Variables &amp; Data Types</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400">PRACTICE</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      <span className="text-sky-400 font-semibold">Engine Rationale:</span> &ldquo;Your current mastery is below target and this competency affects your next step in Control Flow.&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {/* Step D: Evidence & Adaptation */}
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                  D
                </span>
                <div className="space-y-1.5 flex-1">
                  <div className="text-xs text-slate-400 font-mono">4. Evidence &amp; Mastery Adaptation</div>
                  <p className="text-xs text-slate-300">
                    Learner completes the practice exercise scoring 90%. Variables &amp; Types mastery rises to <span className="font-mono text-emerald-400 font-bold">72% (Proficient)</span>.
                  </p>
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-300">
                    ✓ Gap resolved in prerequisite. Control Flow is immediately unblocked as the new recommendation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            COMPLETION != MASTERY (§11)
            ============================================================ */}
        <section className="py-20 border-b border-slate-900 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Pedagogical Rigor
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Completion is not mastery.
              </h2>
              <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Passive consumption creates the illusion of learning. Knowra mathematically separates activity completion from true competence.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 max-w-5xl mx-auto text-xs">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-1.5">
                <div className="font-bold text-slate-300">Activity Completion</div>
                <p className="text-slate-400">An action was taken (e.g. exercise submitted, card answered).</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-1.5">
                <div className="font-bold text-sky-400">Demonstrated Evidence</div>
                <p className="text-slate-400">Verifiable performance score evaluated against structured rubrics.</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-1.5">
                <div className="font-bold text-emerald-400">Mastery Score</div>
                <p className="text-slate-400">Probabilistic measure of competency understanding (0–100%).</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-1.5">
                <div className="font-bold text-indigo-400">Confidence Metric</div>
                <p className="text-slate-400">Statistical certainty of the estimate based on evidence volume.</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-1.5">
                <div className="font-bold text-purple-400">Retention &amp; Recall</div>
                <p className="text-slate-400">Time-decayed memory stability evaluated using modern FSRS spacing.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            CURATED DOMAINS (§12)
            ============================================================ */}
        <section id="curriculum" className="py-20 border-b border-slate-900 bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Curriculum
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Curated Learning Paths
              </h2>
              <p className="text-sm text-slate-400">
                Start with our curated learning paths in Python, Mathematics, and Excel.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Python Junior */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-sky-400 font-bold uppercase">Python Junior</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      7 Competencies
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Foundational Programming</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Variables, expressions, control flow, loops, functions, lists, and debugging with verified code logic.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCtaClick("domain_python")}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  Explore Python Path →
                </button>
              </div>

              {/* Mathematics */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-indigo-400 font-bold uppercase">Mathematics</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      8 Competencies
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Exam Preparation</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Linear equations, quadratic formulas, functions, graphs, coordinate geometry, trigonometry, and statistics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCtaClick("domain_math")}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  Explore Math Path →
                </button>
              </div>

              {/* Excel Pro */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-teal-400 font-bold uppercase">Excel Pro</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      8 Competencies
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Professional Analytics</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Logical formulas, XLOOKUP, conditional aggregations, text transformations, pivot tables, and data validation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCtaClick("domain_excel")}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  Explore Excel Path →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            WHO KNOWRA IS FOR (§13)
            ============================================================ */}
        <section className="py-20 border-b border-slate-900 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Target Learners
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Built for Learners Who Want Verifiable Competence
              </h2>
              <p className="text-sm text-slate-400">
                Designed for those who value measurable skill over endless video watching.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-xl">👩‍💻</div>
                <h3 className="text-sm font-bold text-white">Technical Skill Seekers</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Learn programming without skipping prerequisites or getting lost in tutorial hell.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-xl">📊</div>
                <h3 className="text-sm font-bold text-white">Career Professionals</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upskill in tools like Excel without sitting through basics you already use every day.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-xl">🎓</div>
                <h3 className="text-sm font-bold text-white">Exam Candidates</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Detect hidden prerequisite gaps before high-stakes tests and target weak areas directly.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-xl">🧠</div>
                <h3 className="text-sm font-bold text-white">Self-Directed Learners</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Understand your true knowledge state and follow a personalized path that updates as you grow.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            PRODUCT SCREEN PREVIEW (§14)
            ============================================================ */}
        <section id="preview" className="py-20 border-b border-slate-900 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Product Experience
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                A Look Inside the Knowra Engine
              </h2>
              <p className="text-sm text-slate-400">
                Explore key components of the live learning interface.
              </p>
            </div>

            {/* Preview Navigation */}
            <div className="flex justify-center gap-2 mb-8 overflow-x-auto pb-2">
              {[
                { id: "nba", label: "Next Best Action" },
                { id: "map", label: "Learning Map" },
                { id: "practice", label: "Interactive Practice" },
                { id: "progress", label: "Progress & Gain" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePreviewTab(tab.id as typeof activePreviewTab)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activePreviewTab === tab.id
                      ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Screen Content Preview */}
            <div className="max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 shadow-2xl">
              {activePreviewTab === "nba" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-sky-400 uppercase">Recommended Focus</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">PRACTICE</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Variables &amp; Data Types</h3>
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-300">
                    <span className="text-sky-400 font-semibold">Why this action:</span> Prerequisite mastery is below target (40%). Strengthening this foundation will unblock upcoming conditional logic.
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => handleCtaClick("preview_nba")} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 text-white">
                      Start Activity →
                    </button>
                  </div>
                </div>
              )}

              {activePreviewTab === "map" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase">Interactive Competency Graph</span>
                    <span className="text-xs text-slate-500">7 Competencies</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-sky-500/40 bg-sky-500/10">
                      <div className="font-bold text-white">Variables &amp; Types</div>
                      <div className="text-[11px] text-sky-300 mt-0.5">Current Focus • 40% Mastery</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                      <div className="font-bold text-slate-300">Control Flow</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Prerequisite: Variables &amp; Types</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                      <div className="font-bold text-slate-300">Loops &amp; Iteration</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Prerequisite: Control Flow</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                      <div className="font-bold text-slate-300">Functions &amp; Scope</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Prerequisite: Loops &amp; Iteration</div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === "practice" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 uppercase">Practice Exercise</span>
                    <span className="text-xs text-slate-400">Question 1 of 3</span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    What is the type and value of the expression <code className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-sky-300">type(3.14)</code> in Python?
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-300">&lt;class &apos;int&apos;&gt;</div>
                    <div className="p-2.5 rounded-lg border border-sky-500 bg-sky-500/10 text-white font-medium">&lt;class &apos;float&apos;&gt; ✓</div>
                    <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-300">&lt;class &apos;str&apos;&gt;</div>
                  </div>
                </div>
              )}

              {activePreviewTab === "progress" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-purple-400 uppercase">Independent Learning Gain</span>
                    <span className="text-xs text-slate-400">Continuous Assessment</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50">
                      <div className="text-[10px] text-slate-400">Baseline Diagnostic</div>
                      <div className="text-lg font-bold font-mono text-white mt-1">57%</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50">
                      <div className="text-[10px] text-slate-400">Current Mastery</div>
                      <div className="text-lg font-bold font-mono text-emerald-400 mt-1">72%</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50">
                      <div className="text-[10px] text-slate-400">Evidence Count</div>
                      <div className="text-lg font-bold font-mono text-sky-400 mt-1">8 proofs</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 text-center">
                    Knowra measures learning progress through independent assessment.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================
            FINAL CONVERSION CTA (§17)
            ============================================================ */}
        <section className="py-20 sm:py-28 border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center space-y-6">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              Start Today
            </span>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight max-w-2xl mx-auto leading-tight">
              Stop guessing what to learn next.
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
              Start with your goal. Knowra helps you discover where you are, what needs attention, and what to do next.
            </p>

            <div className="pt-4">
              <button
                onClick={() => handleCtaClick("final_cta")}
                className="px-10 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-2xl shadow-sky-500/30 transition-all transform hover:-translate-y-0.5"
              >
                Start Learning
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================
          FOOTER (§18)
          ============================================================ */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                K
              </div>
              <div>
                <span className="font-bold text-white tracking-tight">KNOWRA</span>
                <span className="text-slate-500 ml-2">— Adaptive Learning Platform</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-slate-400">
              <a href="#how-it-works" className="hover:text-slate-200 transition-colors">How It Works</a>
              <a href="#differentiation" className="hover:text-slate-200 transition-colors">Why Knowra</a>
              <a href="#curriculum" className="hover:text-slate-200 transition-colors">Curated Domains</a>
              <button onClick={onSignIn} className="hover:text-slate-200 transition-colors">
                Learner Sign In
              </button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <div>
              &ldquo;The Learning Engine knows what the learner knows.&rdquo;
            </div>
            <div>
              Knowra Beta 1.0 • Evidence-based adaptive learning engine
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
