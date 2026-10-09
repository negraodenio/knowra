"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { KnowraHorizontalLogo } from "./brand-logo";

interface LandingPageProps {
  onStartLearning: () => void;
  onSignIn: () => void;
}

export function LandingPage({ onStartLearning, onSignIn }: LandingPageProps) {
  const [activeVisualStep, setActiveVisualStep] = useState(3);
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
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-white/20 selection:text-white font-sans antialiased">
      {/* ============================================================
          1. NAVIGATION — EDITORIAL & MINIMAL (§11)
          ============================================================ */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#07090e]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group" aria-label="Knowra Home">
            <KnowraHorizontalLogo theme="dark" className="h-6 w-auto" />
          </Link>

          {/* Minimal Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-xs tracking-wider uppercase text-slate-400">
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                handleHowItWorksClick();
              }}
              className="hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a href="#differentiation" className="hover:text-white transition-colors">
              Why Knowra
            </a>
            <a href="#curriculum" className="hover:text-white transition-colors">
              Curriculum
            </a>
            <a href="#preview" className="hover:text-white transition-colors">
              Instrument Tour
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-4">
            <button
              onClick={onSignIn}
              className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1"
            >
              Sign in
            </button>
            <button
              onClick={() => handleCtaClick("nav_header")}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#07090e] bg-white hover:bg-slate-200 transition-all tracking-wide"
            >
              Start Learning →
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ============================================================
            2. HERO SECTION — EDITORIAL RESTRAINT (§6, §7)
            ============================================================ */}
        <section className="relative pt-20 pb-20 sm:pt-32 sm:pb-28 border-b border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-8">
              {/* Monospace Indicator */}
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                KNOWRA / ADAPTIVE LEARNING ENGINE
              </div>

              {/* Large Editorial Headline */}
              <h1 className="text-4xl sm:text-6xl font-light tracking-tight text-white leading-[1.08]">
                LEARN WHAT YOU NEED.
                <br />
                <span className="font-semibold text-slate-300">
                  NOT WHAT EVERYONE ELSE GETS.
                </span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl">
                Knowra understands what you already know, finds your learning gaps,
                and adapts what you should learn next.
              </p>

              {/* Primary & Secondary Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                <button
                  onClick={() => handleCtaClick("hero_primary")}
                  className="px-7 py-3.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-[#07090e] bg-white hover:bg-slate-200 transition-all"
                >
                  Start Learning →
                </button>
                <button
                  onClick={handleHowItWorksClick}
                  className="px-5 py-3.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  See how it works ↓
                </button>
              </div>

              {/* Quiet Supporting Thesis Line */}
              <div className="pt-4 border-t border-white/[0.06] text-xs font-mono text-slate-400">
                &ldquo;The Learning Engine knows what the learner knows.&rdquo;
              </div>
            </div>

            {/* ============================================================
                3. LEARNING STATE INSTRUMENT VISUAL (§8)
                ============================================================ */}
            <div className="mt-20 max-w-4xl">
              <div className="rounded-xl border border-white/[0.08] bg-[#0c1018] p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-mono text-xs tracking-wider text-slate-300 uppercase">
                      KNOWRA / LEARNING STATE SPECIFICATION
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                    ILLUSTRATIVE SPECIFICATION • DOMAIN: PYTHON JUNIOR
                  </span>
                </div>

                {/* Instrument Tab Triggers */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 font-mono">
                  {[
                    { step: 1, label: "01 State" },
                    { step: 2, label: "02 Diagnostic" },
                    { step: 3, label: "03 Next Best Action" },
                    { step: 4, label: "04 Evidence" },
                    { step: 5, label: "05 Mastery" },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setActiveVisualStep(s.step)}
                      className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                        activeVisualStep === s.step
                          ? "bg-white/10 text-white font-medium"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* State Content Panel */}
                <div className="p-5 rounded-lg border border-white/[0.04] bg-[#07090e]/60 font-mono text-xs">
                  {activeVisualStep === 1 && (
                    <div className="space-y-4">
                      <div className="text-slate-400 uppercase tracking-widest text-[10px]">
                        COMPETENCY MATRIX • 7 TOPICS INITIALIZED
                      </div>
                      <div className="space-y-2 font-mono">
                        <div className="flex justify-between py-1 border-b border-white/[0.04]">
                          <span className="text-slate-300">Variables &amp; Types</span>
                          <span className="text-emerald-400">Strong (85%)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/[0.04]">
                          <span className="text-slate-300">Control Flow</span>
                          <span className="text-amber-400">Developing (42%) — Prerequisite Target</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/[0.04]">
                          <span className="text-slate-300">Functions &amp; Scope</span>
                          <span className="text-slate-500">Locked (Blocked by Control Flow)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeVisualStep === 2 && (
                    <div className="space-y-3">
                      <div className="text-slate-400 uppercase tracking-widest text-[10px]">
                        STARTING POINT DIAGNOSTIC ESTABLISHED
                      </div>
                      <div className="text-slate-200 text-sm font-sans">
                        Baseline diagnostic completed (57.1%). Immutable starting benchmark established. Prior knowledge is recognized; prerequisite weaknesses are isolated without punitive resets.
                      </div>
                    </div>
                  )}

                  {activeVisualStep === 3 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 uppercase tracking-widest text-[10px]">
                          EVALUATED NEXT BEST ACTION
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white font-semibold">
                          PRACTICE
                        </span>
                      </div>
                      <div className="text-base font-semibold text-white font-sans">
                        Control Flow &amp; Conditional Branching
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        <strong className="text-slate-200">Engine Rationale:</strong> Variables mastery is established. Resolving conditional branching unblocks downstream functions in the competency graph.
                      </p>
                    </div>
                  )}

                  {activeVisualStep === 4 && (
                    <div className="space-y-3">
                      <div className="text-slate-400 uppercase tracking-widest text-[10px]">
                        DEMONSTRATED EVIDENCE COLLECTED
                      </div>
                      <div className="flex justify-between text-slate-200">
                        <span>Exercise: Branching Logic Evaluation</span>
                        <span className="text-emerald-400 font-bold">92% Score</span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans">
                        Demonstrated evidence recorded into the learner ledger. Knowledge state updates mathematically rather than assuming completion equates to understanding.
                      </p>
                    </div>
                  )}

                  {activeVisualStep === 5 && (
                    <div className="space-y-3">
                      <div className="text-slate-400 uppercase tracking-widest text-[10px]">
                        STATE UPDATED &amp; GRAPH ADAPTED
                      </div>
                      <div className="flex justify-between text-slate-200">
                        <span>Control Flow Mastery</span>
                        <span className="text-emerald-400 font-bold">Proficient (78%)</span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans">
                        Prerequisite resolved. Functions &amp; Scope is dynamically unlocked, and the next recommendation is automatically recomputed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            4. PROBLEM SECTION — MINIMAL CONTRAST (§12)
            ============================================================ */}
        <section className="py-24 border-b border-white/[0.06] bg-[#07090e]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-4 mb-16">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                THE FOUNDATIONAL DISTINCTION
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight leading-snug">
                Most learning platforms know what you did.
                <br />
                <span className="font-semibold text-slate-200">
                  Knowra focuses on what you know.
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl">
              {/* Column 1: Conventional */}
              <div className="space-y-4 border-l border-white/[0.08] pl-6">
                <div className="font-mono text-xs uppercase tracking-widest text-slate-400">
                  What most platforms see
                </div>
                <ul className="space-y-3 text-xs text-slate-400 leading-relaxed">
                  <li>— Lessons opened or videos watched</li>
                  <li>— Elapsed time spent on page</li>
                  <li>— Generic progress bars and completion percentages</li>
                  <li>— Passive clicks mistaken for comprehension</li>
                </ul>
              </div>

              {/* Column 2: Knowra */}
              <div className="space-y-4 border-l border-white/20 pl-6">
                <div className="font-mono text-xs uppercase tracking-widest text-white">
                  What Knowra seeks
                </div>
                <ul className="space-y-3 text-xs text-slate-200 leading-relaxed">
                  <li>+ What concepts you have verified prior knowledge of</li>
                  <li>+ Where your exact prerequisite learning gaps lie</li>
                  <li>+ The single highest-value action to practice next</li>
                  <li>+ Whether you can independently demonstrate and retain it</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            5. DIFFERENTIATION — NARRATIVE COMPOSITION (§13)
            ============================================================ */}
        <section id="differentiation" className="py-24 border-b border-white/[0.06] bg-[#090d15]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-4 mb-16">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                ARCHITECTURAL DIFFERENTIATION
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                Knowra is not another AI tutor.
              </h2>
              <p className="text-sm text-slate-400">
                A comparison of educational mechanisms.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Paradigm 1 */}
              <div className="space-y-3 border-t border-white/[0.08] pt-6">
                <div className="font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                  01 Traditional Course
                </div>
                <div className="text-base font-semibold text-white">
                  Content → Sequence → Completion
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Identical linear syllabus for every learner. Ignores prior knowledge, pushes forward before prerequisites are mastered, and measures progress by checkboxes.
                </p>
              </div>

              {/* Paradigm 2 */}
              <div className="space-y-3 border-t border-white/[0.08] pt-6">
                <div className="font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                  02 AI Chatbot
                </div>
                <div className="text-base font-semibold text-white">
                  Prompt → Answer → Forget
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Stateless conversational response. Has no persistent learner state, no prerequisite dependency model, and cannot verify whether understanding is retained.
                </p>
              </div>

              {/* Paradigm 3 */}
              <div className="space-y-3 border-t border-white/40 pt-6">
                <div className="font-mono text-[11px] text-emerald-400 uppercase tracking-widest">
                  03 Knowra
                </div>
                <div className="text-base font-semibold text-white">
                  Goal → Knowledge → Evidence → Mastery
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Maintains an evolving learner state, models prerequisite dependencies, isolates gaps, and adapts recommendations based on verified evidence and spaced retention.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            6. HOW KNOWRA WORKS — EDITORIAL SEQUENCE (§14)
            ============================================================ */}
        <section id="how-it-works" className="py-24 border-b border-white/[0.06] bg-[#07090e]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-4 mb-20">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                THE ADAPTIVE ENGINE CYCLE
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                How Knowra works.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  num: "01",
                  title: "Set your goal.",
                  desc: "State your intent in natural language. Knowra aligns it with a curated competency map.",
                },
                {
                  num: "02",
                  title: "Discover where you are.",
                  desc: "A brief starting diagnostic benchmarks prior knowledge and flags prerequisite gaps.",
                },
                {
                  num: "03",
                  title: "See your learning state.",
                  desc: "Inspect your competency graph: what is mastered, what needs focus, what is unblocked.",
                },
                {
                  num: "04",
                  title: "Get your next best action.",
                  desc: "No guessing. Knowra computes the single highest-value exercise for your current state.",
                },
                {
                  num: "05",
                  title: "Produce evidence.",
                  desc: "Solve practical problems, explain concepts in your own words, and recall spaced review cards.",
                },
                {
                  num: "06",
                  title: "Update mastery.",
                  desc: "Your mastery score updates mathematically based on verified performance, not time spent.",
                },
                {
                  num: "07",
                  title: "Adapt continuously.",
                  desc: "As your knowledge shifts, downstream recommendations immediately adapt with you.",
                },
                {
                  num: "08",
                  title: "Measure learning gain.",
                  desc: "Independent post-assessments evaluate your true progress against your starting baseline.",
                },
              ].map((step) => (
                <div key={step.num} className="border-t border-white/[0.08] pt-5 space-y-2">
                  <div className="font-mono text-xs text-slate-400">{step.num}</div>
                  <div className="text-sm font-semibold text-white">{step.title}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            7. PRODUCT DEMONSTRATION — TRANSCRIPT (§15)
            ============================================================ */}
        <section id="demonstration" className="py-24 border-b border-white/[0.06] bg-[#090d15]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-4 mb-16">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                EMPIRICAL DEMONSTRATION
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                Real adaptive learning in action.
              </h2>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                ILLUSTRATIVE EXECUTION TRANSCRIPT • PYTHON JUNIOR
              </p>
            </div>

            <div className="max-w-4xl border border-white/[0.08] rounded-xl bg-[#07090e] p-6 sm:p-10 space-y-8 font-mono text-xs">
              <div className="space-y-1 border-b border-white/[0.06] pb-4">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">01 — GOAL</span>
                <div className="text-sm text-white font-sans font-semibold">
                  &ldquo;I want to become proficient in Python programming.&rdquo;
                </div>
              </div>

              <div className="space-y-2 border-b border-white/[0.06] pb-4">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">02 — STARTING POINT DIAGNOSTIC</span>
                <div className="text-slate-300 font-sans">
                  Variables &amp; Types: Developing (40%) • Control Flow: Gap Detected (Blocked)
                </div>
              </div>

              <div className="space-y-2 border-b border-white/[0.06] pb-4">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">03 — NEXT BEST ACTION</span>
                <div className="text-white font-sans font-semibold">
                  Practice: Variables &amp; Data Types
                </div>
                <div className="text-slate-400 font-sans">
                  Rationale: &ldquo;Your current mastery is below target and this competency affects your next step in Control Flow.&rdquo;
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">04 — OUTCOME &amp; ADAPTATION</span>
                <div className="text-emerald-400 font-sans">
                  Exercise completed (Score: 90%). Variables mastery rises to 72% (Proficient).
                </div>
                <div className="text-slate-300 font-sans">
                  Prerequisite satisfied. Control Flow is immediately promoted to the active recommendation.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            8. COMPLETION IS NOT MASTERY — MAJOR EDITORIAL MOMENT (§16)
            ============================================================ */}
        <section className="py-28 sm:py-36 border-b border-white/[0.06] bg-[#07090e]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-8">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                PEDAGOGICAL PHILOSOPHY
              </div>

              <h2 className="text-4xl sm:text-6xl font-light tracking-tight text-white leading-none">
                COMPLETION
                <br />
                IS NOT
                <br />
                <span className="font-semibold text-slate-300">MASTERY.</span>
              </h2>

              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl">
                An activity can be completed. A question can be answered. A lesson can be finished.
                None of those alone tells you what you actually know.
              </p>

              <div className="pt-8 border-t border-white/[0.08] flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest text-slate-400">
                <span>Activity</span>
                <span>→</span>
                <span className="text-white">Evidence</span>
                <span>→</span>
                <span className="text-white">Mastery</span>
                <span>→</span>
                <span className="text-emerald-400">Retention</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            9. CURATED DOMAINS — ELEGANT INDEX (§17, §18)
            ============================================================ */}
        <section id="curriculum" className="py-24 border-b border-white/[0.06] bg-[#090d15]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-4 mb-16">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                CURATED LEARNING PATHS
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                Currently curated.
              </h2>
              <p className="text-sm text-slate-400">
                Start with our curated learning paths in Python, Mathematics, and Excel.
              </p>
            </div>

            <div className="divide-y divide-white/[0.06] border-t border-b border-white/[0.06] max-w-4xl">
              {[
                {
                  num: "01",
                  title: "Python Junior",
                  domainKey: "domain_python",
                  desc: "Variables, control flow, functions, data structures, and verified code logic.",
                  scope: "7 Core Competencies",
                },
                {
                  num: "02",
                  title: "Mathematics for Exams",
                  domainKey: "domain_math",
                  desc: "Linear systems, quadratic formulas, functions, graphing, and coordinate geometry.",
                  scope: "8 Core Competencies",
                },
                {
                  num: "03",
                  title: "Excel Pro",
                  domainKey: "domain_excel",
                  desc: "Logical functions, modern lookups (XLOOKUP), conditional math, and pivot tables.",
                  scope: "8 Core Competencies",
                },
              ].map((domain) => (
                <div
                  key={domain.num}
                  className="py-6 sm:py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-500">{domain.num}</span>
                      <h3 className="text-lg font-medium text-white group-hover:text-slate-300 transition-colors">
                        {domain.title}
                      </h3>
                      <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                        • {domain.scope}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-xl pl-7">
                      {domain.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCtaClick(domain.domainKey)}
                    className="self-start sm:self-auto text-xs font-medium text-slate-400 group-hover:text-white transition-colors pl-7 sm:pl-0 flex items-center gap-1"
                  >
                    <span>Enter path</span>
                    <span>→</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Persona Statement Integration (§18) */}
            <div className="mt-16 pt-8 border-t border-white/[0.06] max-w-4xl flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
              <div className="font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                FOR LEARNERS WHO TAKE MASTERY SERIOUSLY
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Build a foundational skill. Prepare for a high-stakes exam. Verify your true competence. Knowra adapts to where you actually are.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================
            10. PRODUCT INSTRUMENT PREVIEW (§19)
            ============================================================ */}
        <section id="preview" className="py-24 border-b border-white/[0.06] bg-[#07090e]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl space-y-4 mb-12">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                THE LIVE INSTRUMENT
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                A look inside Knowra.
              </h2>
            </div>

            {/* Preview Navigation */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-1 text-xs font-mono">
              {[
                { id: "nba", label: "Next Best Action" },
                { id: "map", label: "Learning Map" },
                { id: "practice", label: "Practice Exercise" },
                { id: "progress", label: "Progress & Gain" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePreviewTab(tab.id as typeof activePreviewTab)}
                  className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                    activePreviewTab === tab.id
                      ? "bg-white/10 text-white font-medium"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Instrument Container */}
            <div className="max-w-4xl border border-white/[0.08] rounded-xl bg-[#0b0f17] p-6 sm:p-8">
              {activePreviewTab === "nba" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-white/[0.06] pb-3">
                    <span>ACTION DISPATCH</span>
                    <span className="text-white">PRACTICE • EST. 8 MINS</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Variables &amp; Data Types</h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                    Prerequisite mastery is below target (40%). Strengthening this foundation will unblock upcoming conditional branching.
                  </p>
                  <button
                    onClick={() => handleCtaClick("preview_nba")}
                    className="mt-2 px-4 py-2 rounded-lg text-xs font-medium text-[#07090e] bg-white hover:bg-slate-200 transition-colors"
                  >
                    Begin Activity →
                  </button>
                </div>
              )}

              {activePreviewTab === "map" && (
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 border-b border-white/[0.06] pb-3">
                    <span>PREREQUISITE DEPENDENCY GRAPH</span>
                    <span className="text-slate-500">7 COMPETENCIES</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded border border-white/20 bg-white/[0.02]">
                      <div className="text-white font-medium">Variables &amp; Types</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">Active Focus • 40% Baseline</div>
                    </div>
                    <div className="p-3 rounded border border-white/[0.06] bg-transparent">
                      <div className="text-slate-300">Control Flow</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">Prerequisite: Variables</div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === "practice" && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between font-mono text-slate-400 border-b border-white/[0.06] pb-3">
                    <span>INTERACTIVE EXERCISE</span>
                    <span>1 OF 3</span>
                  </div>
                  <div className="text-sm font-medium text-white">
                    What is the type of the expression <code className="font-mono bg-white/10 px-1.5 py-0.5 rounded">type(3.14)</code> in Python?
                  </div>
                  <div className="space-y-2 font-mono text-xs max-w-md">
                    <div className="p-2.5 rounded border border-white/[0.06] text-slate-400">&lt;class &apos;int&apos;&gt;</div>
                    <div className="p-2.5 rounded border border-white/40 bg-white/[0.04] text-white">&lt;class &apos;float&apos;&gt; ✓ Demonstrated</div>
                    <div className="p-2.5 rounded border border-white/[0.06] text-slate-400">&lt;class &apos;str&apos;&gt;</div>
                  </div>
                </div>
              )}

              {activePreviewTab === "progress" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-400 border-b border-white/[0.06] pb-3">
                    <span>INDEPENDENT LEARNING GAIN</span>
                    <span className="text-slate-500">PRE/POST VERIFICATION</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 font-mono text-center pt-2">
                    <div className="p-3 rounded border border-white/[0.06]">
                      <div className="text-[10px] text-slate-500 uppercase">Baseline</div>
                      <div className="text-base font-bold text-white mt-1">57%</div>
                    </div>
                    <div className="p-3 rounded border border-white/[0.06]">
                      <div className="text-[10px] text-slate-500 uppercase">Demonstrated</div>
                      <div className="text-base font-bold text-emerald-400 mt-1">72%</div>
                    </div>
                    <div className="p-3 rounded border border-white/[0.06]">
                      <div className="text-[10px] text-slate-500 uppercase">Verified Evidence</div>
                      <div className="text-base font-bold text-slate-300 mt-1">8 proofs</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 text-center font-mono">
                    Knowra measures learning progress through independent assessment.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================
            11. FINAL CONVERSION CTA — QUIET COMMANDING CLOSER (§20)
            ============================================================ */}
        <section className="py-28 sm:py-36 border-b border-white/[0.06] bg-[#07090e]">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="max-w-2xl space-y-6">
              <div className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">
                BEGIN
              </div>

              <h2 className="text-4xl sm:text-5xl font-light tracking-tight text-white leading-tight">
                STOP GUESSING
                <br />
                <span className="font-semibold text-slate-200">
                  WHAT TO LEARN NEXT.
                </span>
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                Start with your goal. Knowra helps you discover where you are,
                what needs attention, and what to do next.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => handleCtaClick("final_cta")}
                  className="px-8 py-4 rounded-lg text-xs font-semibold uppercase tracking-wider text-[#07090e] bg-white hover:bg-slate-200 transition-all"
                >
                  Start Learning →
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================
          12. FOOTER — MINIMALIST EDITORIAL STATEMENT
          ============================================================ */}
      <footer className="bg-[#07090e] py-12 text-xs text-slate-500 font-mono">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="flex flex-col sm:flex-row items-baseline justify-between gap-6 pb-8 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <KnowraHorizontalLogo theme="dark" className="h-5 w-auto" />
              <span className="text-slate-500">— ADAPTIVE LEARNING ENGINE</span>
            </div>

            <div className="flex items-center gap-6">
              <a href="#how-it-works" className="hover:text-slate-300 transition-colors">How It Works</a>
              <a href="#curriculum" className="hover:text-slate-300 transition-colors">Curriculum</a>
              <a href="#differentiation" className="hover:text-slate-300 transition-colors">Why Knowra</a>
              <button onClick={onSignIn} className="hover:text-slate-300 transition-colors">Sign in</button>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-baseline justify-between gap-4 text-[11px] text-slate-400">
            <div>&ldquo;The Learning Engine knows what the learner knows.&rdquo;</div>
            <div>Knowra Beta 1.0 • Evidence-based adaptive learning platform</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
