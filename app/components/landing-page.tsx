"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { KnowraHorizontalLogo } from "./brand-logo";
import { CANONICAL_PUBLIC_URL } from "@/lib/config/app-url";

interface LandingPageProps {
  onStartLearning: () => void;
  onSignIn: () => void;
}

/**
 * Topographic Overlay SVG - Official Knowra brand elevation signature
 */
function TopographyOverlay({ className = "opacity-[0.07]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Upper flowing ridgelines */}
      <path
        d="M100 200 C 200 150, 400 250, 600 200 C 800 150, 1000 300, 1200 200 C 1300 150, 1400 180, 1500 200"
        stroke="#C95C3F"
        strokeWidth="1.5"
      />
      <path
        d="M120 220 C 220 170, 380 270, 580 220 C 780 170, 1020 280, 1220 220 C 1310 180, 1420 190, 1480 220"
        stroke="#C95C3F"
        strokeWidth="1.5"
      />
      <path
        d="M80 180 C 180 130, 420 230, 620 180 C 820 130, 980 320, 1180 180 C 1280 130, 1380 170, 1520 180"
        stroke="#C95C3F"
        strokeWidth="1.5"
      />
      <path
        d="M400 400 C 500 300, 700 500, 900 350 C 1050 250, 1200 400, 1300 350"
        stroke="#A3A3A3"
        strokeWidth="1"
      />
      <path
        d="M420 420 C 520 320, 680 480, 880 370 C 1030 270, 1180 420, 1280 370"
        stroke="#A3A3A3"
        strokeWidth="1"
      />

      {/* Central concentric topographic contour rings */}
      <path
        d="M 540 290 C 600 220, 790 210, 880 270 C 960 330, 920 460, 820 500 C 710 545, 590 490, 550 425 C 510 365, 500 330, 540 290 Z"
        stroke="#C95C3F"
        strokeWidth="1.2"
      />
      <path
        d="M 570 305 C 620 245, 770 235, 850 285 C 920 335, 890 440, 800 475 C 700 515, 610 470, 580 415 C 550 365, 540 335, 570 305 Z"
        stroke="#C95C3F"
        strokeWidth="1"
      />
      <path
        d="M 600 320 C 640 270, 750 260, 820 300 C 880 340, 860 420, 780 450 C 690 485, 630 450, 600 405 C 570 365, 570 340, 600 320 Z"
        stroke="#A3A3A3"
        strokeWidth="0.8"
      />
      <path
        d="M 630 335 C 660 295, 730 285, 790 315 C 840 345, 825 405, 760 425 C 685 450, 640 430, 620 395 C 600 365, 605 350, 630 335 Z"
        stroke="#C95C3F"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <path
        d="M 660 350 C 680 320, 715 310, 760 330 C 795 350, 785 390, 740 405 C 695 420, 665 405, 650 380 C 640 365, 645 360, 660 350 Z"
        stroke="#C95C3F"
        strokeWidth="1.2"
      />

      {/* Broad radiating contours */}
      <path
        d="M 400 380 C 440 240, 830 160, 1010 240 C 1140 300, 1100 530, 920 590 C 750 645, 500 570, 410 485 C 360 435, 370 400, 400 380 Z"
        stroke="#C95C3F"
        strokeWidth="0.9"
      />
      <path
        d="M 340 400 C 390 220, 880 130, 1080 220 C 1230 290, 1180 580, 970 650 C 770 705, 460 620, 350 515 C 290 455, 300 420, 340 400 Z"
        stroke="#A3A3A3"
        strokeWidth="0.7"
      />

      {/* Lower landscape folds */}
      <path
        d="M-40 560 C 200 480, 450 640, 750 550 C 1000 480, 1250 640, 1500 540"
        stroke="#C95C3F"
        strokeWidth="1.2"
      />
      <path
        d="M-40 610 C 180 530, 420 680, 720 590 C 980 520, 1220 670, 1500 580"
        stroke="#A3A3A3"
        strokeWidth="0.9"
      />
      <path
        d="M-40 660 C 220 580, 400 710, 680 630 C 950 560, 1200 700, 1500 620"
        stroke="#C95C3F"
        strokeWidth="0.7"
      />
    </svg>
  );
}

export function LandingPage({ onStartLearning, onSignIn }: LandingPageProps) {
  const [activeVisualStep, setActiveVisualStep] = useState(3);
  const [activePreviewTab, setActivePreviewTab] = useState<"nba" | "map" | "practice" | "progress">("nba");
  const [urlCopied, setUrlCopied] = useState(false);

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
    <div className="min-h-screen bg-[#0C0C0D] text-[#F4F4F0] flex flex-col selection:bg-[#C95C3F]/30 selection:text-[#F4F4F0] font-sans antialiased">
      {/* ============================================================
          1. NAVIGATION — EDITORIAL & MINIMAL
          ============================================================ */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#0C0C0D]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          {/* Official Brand Lockup */}
          <Link href="/" className="flex items-center gap-3 group" aria-label="Knowra Home">
            <KnowraHorizontalLogo className="h-8 w-auto text-[#F4F4F0]" />
          </Link>

          {/* Minimal Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-xs tracking-wider uppercase text-[#A3A3A3]">
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                handleHowItWorksClick();
              }}
              className="hover:text-[#F4F4F0] transition-colors"
            >
              How It Works
            </a>
            <a href="#differentiation" className="hover:text-[#F4F4F0] transition-colors">
              Why Knowra
            </a>
            <a href="#curriculum" className="hover:text-[#F4F4F0] transition-colors">
              Curriculum
            </a>
            <a href="#preview" className="hover:text-[#F4F4F0] transition-colors">
              Instrument Tour
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-4">
            <button
              onClick={onSignIn}
              className="text-xs text-[#A3A3A3] hover:text-[#F4F4F0] transition-colors px-2 py-1"
            >
              Sign in
            </button>
            <button
              onClick={() => handleCtaClick("nav_header")}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white transition-all tracking-wide"
            >
              Start Learning →
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ============================================================
            2. HERO SECTION — SIDE-BY-SIDE WITH TOPOGRAPHY OVERLAY
            ============================================================ */}
        <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-white/[0.06] overflow-hidden">
          {/* Subtle Topographic Background Signature */}
          <TopographyOverlay className="opacity-[0.08]" />

          <div className="relative max-w-7xl mx-auto px-6 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              {/* Left Column: Headline and Thesis */}
              <div className="lg:col-span-7 space-y-7">
                {/* Monospace Indicator in Copper */}
                <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase font-medium">
                  KNOWRA / ADAPTIVE LEARNING ENGINE
                </div>

                {/* Large Editorial Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-[#F4F4F0] leading-[1.08]">
                  LEARN WHAT YOU NEED.
                  <br />
                  <span className="font-semibold text-[#F4F4F0]">
                    NOT WHAT EVERYONE ELSE GETS.
                  </span>
                </h1>

                {/* Supporting Copy */}
                <p className="text-base sm:text-lg text-[#A3A3A3] font-normal leading-relaxed max-w-xl">
                  Knowra understands what you already know, finds your learning gaps, and adapts what you should learn next.
                </p>

                {/* Primary & Secondary Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                  <button
                    onClick={() => handleCtaClick("hero_primary")}
                    className="px-7 py-3.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white transition-all shadow-md"
                  >
                    Start Learning →
                  </button>
                  <button
                    onClick={handleHowItWorksClick}
                    className="px-4 py-3.5 rounded-lg text-xs font-medium text-[#A3A3A3] hover:text-[#F4F4F0] transition-colors flex items-center gap-1.5"
                  >
                    See how it works ↓
                  </button>
                </div>

                {/* Monospace Supporting Thesis */}
                <div className="pt-6 border-t border-white/[0.06] text-xs font-mono text-[#A3A3A3]">
                  &ldquo;The Learning Engine knows what the learner knows.&rdquo;
                </div>
              </div>

              {/* Right Column: Learning State Specification Card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-white/[0.08] bg-[#161617]/95 backdrop-blur-md p-6 sm:p-7 space-y-5 shadow-2xl relative">
                  {/* Card Header with Copper Status Dot */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3.5">
                    <span className="font-mono text-xs tracking-wider text-[#F4F4F0] uppercase font-medium">
                      KNOWRA / LEARNING STATE SPECIFICATION
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C95C3F]" />
                  </div>

                  {/* Instrument Tab Triggers */}
                  <div className="flex items-center gap-2 overflow-x-auto text-[11px] pb-1 font-mono border-b border-white/[0.06]">
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
                        className={`pb-2 px-1 transition-all whitespace-nowrap text-xs ${
                          activeVisualStep === s.step
                            ? "text-[#F4F4F0] font-semibold border-b-2 border-[#C95C3F]"
                            : "text-[#A3A3A3] hover:text-[#F4F4F0] border-b-2 border-transparent"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* State Content Panel */}
                  <div className="p-5 rounded-xl border border-white/[0.06] bg-[#0C0C0D]/85 font-mono text-xs">
                    {activeVisualStep === 1 && (
                      <div className="space-y-4">
                        <div className="text-[#A3A3A3] uppercase tracking-widest text-[10px]">
                          COMPETENCY MATRIX • 7 TOPICS INITIALIZED
                        </div>
                        <div className="space-y-2 font-mono">
                          <div className="flex justify-between py-1 border-b border-white/[0.04]">
                            <span className="text-[#F4F4F0]">Variables &amp; Types</span>
                            <span className="text-[#C95C3F] font-semibold">Strong (85%)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-white/[0.04]">
                            <span className="text-[#F4F4F0]">Control Flow</span>
                            <span className="text-[#C95C3F]">Developing (42%) — Prerequisite Target</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-white/[0.04]">
                            <span className="text-[#A3A3A3]">Functions &amp; Scope</span>
                            <span className="text-[#A3A3A3]">Locked (Blocked by Control Flow)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeVisualStep === 2 && (
                      <div className="space-y-3">
                        <div className="text-[#A3A3A3] uppercase tracking-widest text-[10px]">
                          STARTING POINT DIAGNOSTIC ESTABLISHED
                        </div>
                        <div className="text-[#F4F4F0] text-sm font-sans leading-relaxed">
                          Baseline diagnostic completed (57.1%). Immutable starting benchmark established. Prior knowledge is recognized; prerequisite weaknesses are isolated without punitive resets.
                        </div>
                      </div>
                    )}

                    {activeVisualStep === 3 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[#A3A3A3] uppercase tracking-widest text-[10px]">
                            EVALUATED NEXT BEST ACTION
                          </span>
                          <span className="px-2.5 py-0.5 rounded text-[10px] bg-[#C95C3F]/10 text-[#C95C3F] border border-[#C95C3F]/30 font-semibold tracking-wider">
                            PRACTICE
                          </span>
                        </div>
                        <div className="text-base sm:text-lg font-semibold text-[#F4F4F0] font-sans">
                          Control Flow &amp; Conditional Branching
                        </div>
                        <p className="text-xs text-[#A3A3A3] font-sans leading-relaxed">
                          <strong className="text-[#F4F4F0]">Engine Rationale:</strong> Variables mastery is established. Resolving conditional branching unblocks downstream functions in the competency graph.
                        </p>
                        <div className="pt-3 border-t border-white/[0.06] text-[11px] font-mono text-[#A3A3A3] flex items-center justify-between">
                          <span>
                            Variables &amp; Types: <span className="text-[#C95C3F]">Developing (40%)</span> • Control Flow: <span className="text-[#C95C3F]">Gap Detected (Blocked)</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {activeVisualStep === 4 && (
                      <div className="space-y-3">
                        <div className="text-[#A3A3A3] uppercase tracking-widest text-[10px]">
                          DEMONSTRATED EVIDENCE COLLECTED
                        </div>
                        <div className="flex justify-between text-[#F4F4F0]">
                          <span>Exercise: Branching Logic Evaluation</span>
                          <span className="text-[#C95C3F] font-bold">92% Score</span>
                        </div>
                        <p className="text-xs text-[#A3A3A3] font-sans leading-relaxed">
                          Demonstrated evidence recorded into the learner ledger. Knowledge state updates mathematically rather than assuming completion equates to understanding.
                        </p>
                      </div>
                    )}

                    {activeVisualStep === 5 && (
                      <div className="space-y-3">
                        <div className="text-[#A3A3A3] uppercase tracking-widest text-[10px]">
                          STATE UPDATED &amp; GRAPH ADAPTED
                        </div>
                        <div className="flex justify-between text-[#F4F4F0]">
                          <span>Control Flow Mastery</span>
                          <span className="text-[#C95C3F] font-bold">Proficient (78%)</span>
                        </div>
                        <p className="text-xs text-[#A3A3A3] font-sans leading-relaxed">
                          Prerequisite resolved. Functions &amp; Scope is dynamically unlocked, and the next recommendation is automatically recomputed.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            3. DIFFERENTIATION — 4-COLUMN PARADIGM COMPARISON
            ============================================================ */}
        <section id="differentiation" className="py-20 border-b border-white/[0.06] bg-[#0C0C0D]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="space-y-2 mb-12">
              <h2 className="text-2xl sm:text-3xl font-light text-[#F4F4F0] tracking-tight">
                Knowra is not another AI tutor.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Paradigm 01 */}
              <div className="space-y-3 border-t border-white/[0.08] pt-5">
                <div className="font-mono text-[11px] text-[#A3A3A3] uppercase tracking-widest">
                  01
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider text-[#F4F4F0]">
                  TRADITIONAL COURSE
                </div>
                <div className="text-xs text-[#A3A3A3]">
                  Content → Sequence → Completion
                </div>
                <p className="text-xs text-[#A3A3A3]/80 leading-relaxed pt-1">
                  Identical linear syllabus for every learner. Ignores prior knowledge and measures progress by checkboxes.
                </p>
              </div>

              {/* Paradigm 02 */}
              <div className="space-y-3 border-t border-white/[0.08] pt-5">
                <div className="font-mono text-[11px] text-[#A3A3A3] uppercase tracking-widest">
                  02
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider text-[#F4F4F0]">
                  AI CHATBOT
                </div>
                <div className="text-xs text-[#A3A3A3]">
                  Prompt → Answer → Forget
                </div>
                <p className="text-xs text-[#A3A3A3]/80 leading-relaxed pt-1">
                  Stateless conversational response. Has no persistent learner state and cannot verify retention.
                </p>
              </div>

              {/* Paradigm 03 — Official KNOWRA Highlight */}
              <div className="space-y-3 border-t border-[#C95C3F]/60 pt-5">
                <div className="font-mono text-[11px] text-[#C95C3F] uppercase tracking-widest font-semibold">
                  03
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider text-[#F4F4F0]">
                  KNOWRA
                </div>
                <div className="inline-block px-2.5 py-1 rounded bg-[#C95C3F]/20 text-[#F4F4F0] border border-[#C95C3F]/50 text-xs font-mono font-medium">
                  Goal → Knowledge → Evidence → Mastery
                </div>
                <p className="text-xs text-[#A3A3A3] leading-relaxed pt-1">
                  Maintains an evolving learner state, models prerequisite dependencies, isolates gaps, and adapts continuously.
                </p>
              </div>

              {/* Paradigm 04 — KNOWRA Adaptive Retention */}
              <div className="space-y-3 border-t border-white/[0.08] pt-5">
                <div className="font-mono text-[11px] text-[#A3A3A3] uppercase tracking-widest">
                  04
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider text-[#F4F4F0]">
                  KNOWRA
                </div>
                <div className="text-xs text-[#A3A3A3] font-mono">
                  Goal → Knowledge → Evidence → Retention
                </div>
                <p className="text-xs text-[#A3A3A3]/80 leading-relaxed pt-1">
                  Demonstrated evidence recorded into an immutable ledger, driving mathematical state updates and spaced retention.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            4. PROBLEM SECTION — MINIMAL CONTRAST
            ============================================================ */}
        <section className="py-20 border-b border-white/[0.06] bg-[#0C0C0D]">
          <div className="max-w-5xl mx-auto px-6 sm:px-8">
            <div className="space-y-4 mb-14">
              <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase">
                THE FOUNDATIONAL DISTINCTION
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-[#F4F4F0] tracking-tight leading-snug">
                Most learning platforms know what you did.
                <br />
                <span className="font-semibold text-[#F4F4F0]">
                  Knowra focuses on what you know.
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Column 1: Conventional */}
              <div className="space-y-4 border-l border-white/[0.08] pl-6">
                <div className="font-mono text-xs uppercase tracking-widest text-[#A3A3A3]">
                  What most platforms see
                </div>
                <ul className="space-y-3 text-xs text-[#A3A3A3] leading-relaxed">
                  <li>— Lessons opened or videos watched</li>
                  <li>— Elapsed time spent on page</li>
                  <li>— Generic progress bars and completion percentages</li>
                  <li>— Passive clicks mistaken for comprehension</li>
                </ul>
              </div>

              {/* Column 2: Knowra */}
              <div className="space-y-4 border-l border-[#C95C3F]/40 pl-6">
                <div className="font-mono text-xs uppercase tracking-widest text-[#F4F4F0]">
                  What Knowra seeks
                </div>
                <ul className="space-y-3 text-xs text-[#F4F4F0] leading-relaxed">
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
            5. HOW KNOWRA WORKS — EDITORIAL SEQUENCE
            ============================================================ */}
        <section id="how-it-works" className="py-20 border-b border-white/[0.06] bg-[#0C0C0D]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="space-y-4 mb-16">
              <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase">
                THE ADAPTIVE ENGINE CYCLE
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-[#F4F4F0] tracking-tight">
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
                  <div className="font-mono text-xs text-[#C95C3F] font-medium">{step.num}</div>
                  <div className="text-sm font-semibold text-[#F4F4F0]">{step.title}</div>
                  <p className="text-xs text-[#A3A3A3] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            6. PRODUCT DEMONSTRATION — TRANSCRIPT
            ============================================================ */}
        <section id="demonstration" className="relative py-20 border-b border-white/[0.06] bg-[#0C0C0D] overflow-hidden">
          <TopographyOverlay className="opacity-[0.05]" />

          <div className="relative max-w-5xl mx-auto px-6 sm:px-8">
            <div className="space-y-4 mb-14">
              <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase">
                EMPIRICAL DEMONSTRATION
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-[#F4F4F0] tracking-tight">
                Real adaptive learning in action.
              </h2>
              <p className="text-xs font-mono text-[#A3A3A3] uppercase tracking-widest">
                ILLUSTRATIVE EXECUTION TRANSCRIPT • PYTHON JUNIOR
              </p>
            </div>

            <div className="border border-white/[0.08] rounded-2xl bg-[#161617] p-6 sm:p-10 space-y-7 font-mono text-xs">
              <div className="space-y-1.5 border-b border-white/[0.06] pb-4">
                <span className="text-[#A3A3A3] uppercase tracking-wider text-[10px]">01 — GOAL</span>
                <div className="text-sm text-[#F4F4F0] font-sans font-semibold">
                  &ldquo;I want to become proficient in Python programming.&rdquo;
                </div>
              </div>

              <div className="space-y-2 border-b border-white/[0.06] pb-4">
                <span className="text-[#A3A3A3] uppercase tracking-wider text-[10px]">02 — STARTING POINT DIAGNOSTIC</span>
                <div className="text-[#F4F4F0] font-sans">
                  Variables &amp; Types: <span className="text-[#C95C3F]">Developing (40%)</span> • Control Flow: <span className="text-[#C95C3F]">Gap Detected (Blocked)</span>
                </div>
              </div>

              <div className="space-y-2 border-b border-white/[0.06] pb-4">
                <span className="text-[#A3A3A3] uppercase tracking-wider text-[10px]">03 — NEXT BEST ACTION</span>
                <div className="text-[#F4F4F0] font-sans font-semibold">
                  Practice: Variables &amp; Data Types
                </div>
                <div className="text-[#A3A3A3] font-sans">
                  Rationale: &ldquo;Your current mastery is below target and this competency affects your next step in Control Flow.&rdquo;
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[#A3A3A3] uppercase tracking-wider text-[10px]">04 — OUTCOME &amp; ADAPTATION</span>
                <div className="text-[#C95C3F] font-sans font-medium">
                  Exercise completed (Score: 90%). Variables mastery rises to 72% (Proficient).
                </div>
                <div className="text-[#A3A3A3] font-sans">
                  Prerequisite satisfied. Control Flow is immediately promoted to the active recommendation.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            7. COMPLETION IS NOT MASTERY
            ============================================================ */}
        <section className="py-24 sm:py-32 border-b border-white/[0.06] bg-[#0C0C0D]">
          <div className="max-w-5xl mx-auto px-6 sm:px-8">
            <div className="space-y-8">
              <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase">
                PEDAGOGICAL PHILOSOPHY
              </div>

              <h2 className="text-4xl sm:text-6xl font-light tracking-tight text-[#F4F4F0] leading-none">
                COMPLETION
                <br />
                IS NOT
                <br />
                <span className="font-semibold text-[#F4F4F0]">MASTERY.</span>
              </h2>

              <p className="text-base sm:text-lg text-[#A3A3A3] font-normal leading-relaxed max-w-2xl">
                An activity can be completed. A question can be answered. A lesson can be finished.
                None of those alone tells you what you actually know.
              </p>

              <div className="pt-8 border-t border-white/[0.08] flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest text-[#A3A3A3]">
                <span>Activity</span>
                <span>→</span>
                <span className="text-[#F4F4F0]">Evidence</span>
                <span>→</span>
                <span className="text-[#F4F4F0]">Mastery</span>
                <span>→</span>
                <span className="text-[#C95C3F] font-semibold">Retention</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            8. CURATED DOMAINS — ELEGANT INDEX (max-w-5xl)
            ============================================================ */}
        <section id="curriculum" className="py-20 border-b border-white/[0.06] bg-[#0C0C0D]">
          <div className="max-w-5xl mx-auto px-6 sm:px-8">
            <div className="space-y-3 mb-14">
              <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase">
                CURATED LEARNING PATHS
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-[#F4F4F0] tracking-tight">
                Currently curated.
              </h2>
              <p className="text-sm text-[#A3A3A3]">
                Start with our curated learning paths in Python, Mathematics, and Excel.
              </p>
            </div>

            <div className="divide-y divide-white/[0.06] border-t border-b border-white/[0.06]">
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
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#C95C3F]">{domain.num}</span>
                      <h3 className="text-lg font-medium text-[#F4F4F0] group-hover:text-white transition-colors">
                        {domain.title}
                      </h3>
                      <span className="font-mono text-[10px] text-[#A3A3A3] uppercase tracking-wider">
                        • {domain.scope}
                      </span>
                    </div>
                    <p className="text-xs text-[#A3A3A3] max-w-xl pl-7">
                      {domain.desc}
                    </p>
                  </div>

                  {/* Ergonomic integrated button closer to the item */}
                  <button
                    onClick={() => handleCtaClick(domain.domainKey)}
                    className="self-start sm:self-auto text-xs font-medium text-[#A3A3A3] group-hover:text-[#F4F4F0] transition-colors pl-7 sm:pl-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/[0.15] bg-[#161617]"
                  >
                    <span>Enter path</span>
                    <span>→</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Persona Statement Integration */}
            <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
              <div className="font-mono text-[11px] text-[#A3A3A3] uppercase tracking-widest">
                FOR LEARNERS WHO TAKE MASTERY SERIOUSLY
              </div>
              <p className="text-xs text-[#A3A3A3] max-w-md">
                Build a foundational skill. Prepare for a high-stakes exam. Verify your true competence. Knowra adapts to where you actually are.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================
            9. PRODUCT INSTRUMENT PREVIEW
            ============================================================ */}
        <section id="preview" className="py-20 border-b border-white/[0.06] bg-[#0C0C0D]">
          <div className="max-w-5xl mx-auto px-6 sm:px-8">
            <div className="space-y-3 mb-10">
              <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase">
                THE LIVE INSTRUMENT
              </div>
              <h2 className="text-3xl sm:text-4xl font-light text-[#F4F4F0] tracking-tight">
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
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    activePreviewTab === tab.id
                      ? "bg-[#C95C3F]/15 text-[#F4F4F0] border border-[#C95C3F]/40 font-medium"
                      : "text-[#A3A3A3] hover:text-[#F4F4F0]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Instrument Container */}
            <div className="border border-white/[0.08] rounded-2xl bg-[#161617] p-6 sm:p-8">
              {activePreviewTab === "nba" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono text-[#A3A3A3] border-b border-white/[0.06] pb-3">
                    <span>ACTION DISPATCH</span>
                    <span className="text-[#C95C3F] font-semibold">PRACTICE • EST. 8 MINS</span>
                  </div>
                  <h3 className="text-xl font-semibold text-[#F4F4F0]">Variables &amp; Data Types</h3>
                  <p className="text-xs text-[#A3A3A3] leading-relaxed max-w-xl">
                    Prerequisite mastery is below target (40%). Strengthening this foundation will unblock upcoming conditional branching.
                  </p>
                  <button
                    onClick={() => handleCtaClick("preview_nba")}
                    className="mt-2 px-4 py-2 rounded-lg text-xs font-medium text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white transition-colors"
                  >
                    Begin Activity →
                  </button>
                </div>
              )}

              {activePreviewTab === "map" && (
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between text-[#A3A3A3] border-b border-white/[0.06] pb-3">
                    <span>PREREQUISITE DEPENDENCY GRAPH</span>
                    <span className="text-[#A3A3A3]">7 COMPETENCIES</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl border border-[#C95C3F]/30 bg-[#C95C3F]/5">
                      <div className="text-[#F4F4F0] font-medium">Variables &amp; Types</div>
                      <div className="text-[#C95C3F] text-[11px] mt-0.5">Active Focus • 40% Baseline</div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-transparent">
                      <div className="text-[#A3A3A3]">Control Flow</div>
                      <div className="text-[#A3A3A3]/70 text-[11px] mt-0.5">Prerequisite: Variables</div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === "practice" && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between font-mono text-[#A3A3A3] border-b border-white/[0.06] pb-3">
                    <span>INTERACTIVE EXERCISE</span>
                    <span>1 OF 3</span>
                  </div>
                  <div className="text-sm font-medium text-[#F4F4F0]">
                    What is the type of the expression <code className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-[#F4F4F0]">type(3.14)</code> in Python?
                  </div>
                  <div className="space-y-2 font-mono text-xs max-w-md">
                    <div className="p-2.5 rounded-lg border border-white/[0.06] text-[#A3A3A3]">&lt;class &apos;int&apos;&gt;</div>
                    <div className="p-2.5 rounded-lg border border-[#C95C3F]/50 bg-[#C95C3F]/10 text-[#F4F4F0] font-medium">
                      &lt;class &apos;float&apos;&gt; ✓ Demonstrated
                    </div>
                    <div className="p-2.5 rounded-lg border border-white/[0.06] text-[#A3A3A3]">&lt;class &apos;str&apos;&gt;</div>
                  </div>
                </div>
              )}

              {activePreviewTab === "progress" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between font-mono text-xs text-[#A3A3A3] border-b border-white/[0.06] pb-3">
                    <span>INDEPENDENT LEARNING GAIN</span>
                    <span className="text-[#A3A3A3]">PRE/POST VERIFICATION</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 font-mono text-center pt-2">
                    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0C0C0D]">
                      <div className="text-[10px] text-[#A3A3A3] uppercase">Baseline</div>
                      <div className="text-base font-bold text-[#F4F4F0] mt-1">57%</div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[#C95C3F]/30 bg-[#C95C3F]/5">
                      <div className="text-[10px] text-[#C95C3F] uppercase font-semibold">Demonstrated</div>
                      <div className="text-base font-bold text-[#C95C3F] mt-1">72%</div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0C0C0D]">
                      <div className="text-[10px] text-[#A3A3A3] uppercase">Verified Evidence</div>
                      <div className="text-base font-bold text-[#F4F4F0] mt-1">8 proofs</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#A3A3A3] text-center font-mono">
                    Knowra measures learning progress through independent assessment.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================
            10. FINAL CONVERSION CTA
            ============================================================ */}
        <section className="py-24 sm:py-32 border-b border-white/[0.06] bg-[#0C0C0D]">
          <div className="max-w-5xl mx-auto px-6 sm:px-8">
            <div className="max-w-2xl space-y-6">
              <div className="font-mono text-[11px] tracking-[0.25em] text-[#C95C3F] uppercase">
                BEGIN
              </div>

              <h2 className="text-4xl sm:text-5xl font-light tracking-tight text-[#F4F4F0] leading-tight">
                STOP GUESSING
                <br />
                <span className="font-semibold text-[#F4F4F0]">
                  WHAT TO LEARN NEXT.
                </span>
              </h2>

              <p className="text-sm sm:text-base text-[#A3A3A3] leading-relaxed font-normal">
                Start with your goal. Knowra helps you discover where you are,
                what needs attention, and what to do next.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => handleCtaClick("final_cta")}
                  className="px-8 py-4 rounded-lg text-xs font-semibold uppercase tracking-wider text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white transition-all shadow-lg"
                >
                  Start Learning →
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================
          11. FOOTER
          ============================================================ */}
      <footer className="bg-[#0C0C0D] py-12 text-xs text-[#A3A3A3] font-mono">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex flex-col sm:flex-row items-baseline justify-between gap-6 pb-8 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <KnowraHorizontalLogo className="h-6 w-auto text-[#F4F4F0]" />
              <span className="text-[#A3A3A3]">— ADAPTIVE LEARNING ENGINE</span>
            </div>

            <div className="flex items-center gap-6">
              <a href="#how-it-works" className="hover:text-[#F4F4F0] transition-colors">How It Works</a>
              <a href="#curriculum" className="hover:text-[#F4F4F0] transition-colors">Curriculum</a>
              <a href="#differentiation" className="hover:text-[#F4F4F0] transition-colors">Why Knowra</a>
              <button onClick={onSignIn} className="hover:text-[#F4F4F0] transition-colors">Sign in</button>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-baseline justify-between gap-4 text-[11px] text-[#A3A3A3]/80">
            <div>&ldquo;The Learning Engine knows what the learner knows.&rdquo;</div>
            <div className="flex flex-wrap items-center gap-3">
              <span>Knowra Beta 1.0 • Evidence-based adaptive learning platform</span>
              <span>•</span>
              <div className="inline-flex items-center gap-2 font-mono">
                <a
                  href={CANONICAL_PUBLIC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F4F4F0] hover:text-[#C95C3F] underline transition-colors"
                  title={`Open ${CANONICAL_PUBLIC_URL}`}
                >
                  {CANONICAL_PUBLIC_URL}
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(CANONICAL_PUBLIC_URL);
                      setUrlCopied(true);
                      setTimeout(() => setUrlCopied(false), 2000);
                    } catch {
                      // Clipboard fallback
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.06] hover:bg-white/[0.12] text-[#F4F4F0] transition-colors"
                  title="Copy published application URL"
                >
                  {urlCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
