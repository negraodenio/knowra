"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLearner } from "../lib/use-learner";
import { KnowraHorizontalLogo } from "./brand-logo";
import { CANONICAL_PUBLIC_URL } from "@/lib/config/app-url";

export function LearnerNav() {
  const pathname = usePathname();
  const { userId, userEmail, signOut, activeGoal, goals, selectGoal } = useLearner();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showGoalMenu, setShowGoalMenu] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const sortedNavGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [goals]);

  const navLinks = [
    { href: "/", label: "Home", icon: "✨" },
    { href: "/map", label: "Learning Map", icon: "🗺️" },
    { href: "/activity", label: "Practice", icon: "🎯" },
    { href: "/progress", label: "Progress", icon: "📈" },
    { href: "/history", label: "History", icon: "📜" },
  ];

  const getDomainLabel = (domainId?: string) => {
    if (!domainId) return "Learning Track";
    switch (domainId) {
      case "python-junior":
        return "Python Junior";
      case "math-exams":
        return "Mathematics";
      case "excel-pro":
        return "Excel Pro";
      default:
        if (domainId.startsWith("dyn-")) {
          const clean = domainId.replace(/^dyn-/, "").replace(/-/g, " ");
          return clean.charAt(0).toUpperCase() + clean.slice(1);
        }
        return "Adaptive Track";
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#0C0C0D]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Thesis */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group" aria-label="Knowra Home">
              <KnowraHorizontalLogo className="h-7 w-auto text-[#F4F4F0]" />
            </Link>

            {/* Active Goal Selector (Only when authenticated) */}
            {userId && activeGoal ? (
              <div className="relative">
                <button
                  onClick={() => setShowGoalMenu(!showGoalMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#161617] hover:border-white/[0.16] text-xs font-medium text-[#F4F4F0] transition-colors max-w-[200px] sm:max-w-[260px]"
                  title={`${getDomainLabel(activeGoal.domainId)}: ${activeGoal.title}`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#C95C3F] shrink-0" />
                  <span className="font-semibold text-[#A3A3A3] shrink-0 hidden sm:inline">
                    {getDomainLabel(activeGoal.domainId)}:
                  </span>
                  <span className="truncate text-[#F4F4F0]">
                    {activeGoal.title}
                  </span>
                  <span className="text-[#A3A3A3] text-[10px] shrink-0">▼</span>
                </button>

                {showGoalMenu && (
                  <div className="absolute left-0 mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#161617] p-2 shadow-2xl z-50">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#A3A3A3] px-3 py-1.5 uppercase tracking-wider">
                      <span>Your Learning Goals</span>
                      <span className="font-mono text-[10px] text-[#A3A3A3]">{goals.length}</span>
                    </div>
                    <div className="space-y-1 max-h-64 sm:max-h-72 overflow-y-auto pr-1">
                      {sortedNavGoals.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            selectGoal(g.id);
                            setShowGoalMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                            g.id === activeGoal.id
                              ? "bg-[#C95C3F]/10 text-[#F4F4F0] font-semibold border border-[#C95C3F]/30"
                              : "hover:bg-white/[0.04] text-[#A3A3A3]"
                          }`}
                        >
                          <div className="truncate mr-2 min-w-0">
                            <div className="font-medium truncate text-[#F4F4F0]" title={g.title}>{g.title}</div>
                            <div className="text-[10px] text-[#A3A3A3]">
                              {getDomainLabel(g.domainId)}
                            </div>
                          </div>
                          {g.id === activeGoal.id && <span className="shrink-0 text-[#C95C3F]">✓</span>}
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 mt-2 border-t border-white/[0.06]">
                      <Link
                        href="/"
                        onClick={() => setShowGoalMenu(false)}
                        className="block w-full text-center px-3 py-1.5 rounded-lg text-xs bg-white/[0.04] hover:bg-white/[0.08] text-[#F4F4F0] font-medium transition-colors"
                      >
                        + Create New Goal
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : userId ? (
              <span className="text-xs text-[#A3A3A3] bg-[#161617] px-2.5 py-1 rounded-md border border-white/[0.08] hidden md:inline">
                No active goal set
              </span>
            ) : null}
          </div>

          {/* Navigation Links */}
          {userId ? (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-white/[0.08] text-[#F4F4F0] shadow-sm border border-white/[0.12]"
                        : "text-[#A3A3A3] hover:text-[#F4F4F0] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="text-xs">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#A3A3A3]">
              <Link href="/#how-it-works" className="hover:text-[#F4F4F0] transition-colors">
                How It Works
              </Link>
              <Link href="/#differentiation" className="hover:text-[#F4F4F0] transition-colors">
                Why Knowra
              </Link>
              <Link href="/#curriculum" className="hover:text-[#F4F4F0] transition-colors">
                Curriculum
              </Link>
            </nav>
          )}

          {/* Learner Switcher / Profile or Auth Buttons */}
          <div className="flex items-center gap-3">
            {userId ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1 rounded-lg border border-white/[0.08] bg-[#161617] hover:border-white/[0.16] text-xs text-[#F4F4F0] transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-[10px] text-[#C95C3F] font-semibold">
                    👤
                  </div>
                  <span className="font-mono text-[11px] text-[#A3A3A3] max-w-[100px] truncate">
                    {userId}
                  </span>
                  <span className="text-[#A3A3A3] text-[10px]">▼</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/[0.08] bg-[#161617] p-3 shadow-2xl z-50">
                    <div className="text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-wider mb-2">
                      Authenticated Learner
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#0C0C0D] border border-white/[0.06] mb-3 font-mono">
                      <div className="text-xs text-[#F4F4F0] truncate">
                        {userEmail || userId}
                      </div>
                      <div className="text-[10px] text-[#C95C3F] mt-0.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C95C3F]" />
                        <span>Supabase Session Active</span>
                      </div>
                    </div>

                    {/* Published Application Address */}
                    <div className="pt-2 pb-2 mb-2 border-t border-white/[0.06]">
                      <div className="text-[10px] font-semibold text-[#A3A3A3] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Published App</span>
                        {urlCopied && <span className="text-[#C95C3F] font-mono text-[9px] uppercase">Copied!</span>}
                      </div>
                      <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-[#0C0C0D] border border-white/[0.06]">
                        <a
                          href={CANONICAL_PUBLIC_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-[#F4F4F0] hover:text-[#C95C3F] truncate underline transition-colors"
                          title={`Open ${CANONICAL_PUBLIC_URL}`}
                        >
                          {CANONICAL_PUBLIC_URL.replace(/^https?:\/\//, "")}
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
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#F4F4F0] transition-colors shrink-0"
                          title="Copy published application URL"
                        >
                          {urlCopied ? "✓" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {/* Sign Out Action */}
                    <div className="border-t border-white/[0.06] pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          signOut();
                          setShowUserMenu(false);
                        }}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-center transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#A3A3A3] hover:text-[#F4F4F0] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white transition-all shadow-sm"
                >
                  Start Learning →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        {userId && (
          <div className="md:hidden flex items-center justify-between py-2 border-t border-white/[0.06] overflow-x-auto gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-white/[0.08] text-[#F4F4F0] font-semibold"
                      : "text-[#A3A3A3] hover:text-[#F4F4F0]"
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
