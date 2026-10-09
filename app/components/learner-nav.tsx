"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLearner } from "../lib/use-learner";
import { KnowraHorizontalLogo } from "./brand-logo";

export function LearnerNav() {
  const pathname = usePathname();
  const { userId, userEmail, signOut, activeGoal, goals, selectGoal } = useLearner();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showGoalMenu, setShowGoalMenu] = useState(false);

  const navLinks = [
    { href: "/", label: "Home", icon: "✨" },
    { href: "/map", label: "Learning Map", icon: "🗺️" },
    { href: "/activity", label: "Practice", icon: "🎯" },
    { href: "/progress", label: "Progress & Gain", icon: "📈" },
    { href: "/history", label: "History", icon: "📜" },
  ];

  const getDomainLabel = (domainId?: string) => {
    switch (domainId) {
      case "python-junior":
        return "Python Junior";
      case "math-exams":
        return "Mathematics";
      case "excel-pro":
        return "Excel Pro";
      default:
        return "Curriculum";
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#07090e]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Thesis */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group" aria-label="Knowra Home">
              <KnowraHorizontalLogo theme="dark" className="h-6 w-auto" />
            </Link>

            {/* Active Goal Selector (Only when authenticated) */}
            {userId && activeGoal ? (
              <div className="relative">
                <button
                  onClick={() => setShowGoalMenu(!showGoalMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 text-xs font-medium text-slate-200 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-slate-300">
                    {getDomainLabel(activeGoal.domainId)}:
                  </span>
                  <span className="truncate max-w-[150px] sm:max-w-[200px] text-slate-400">
                    {activeGoal.title}
                  </span>
                  <span className="text-slate-500 text-[10px]">▼</span>
                </button>

                {showGoalMenu && (
                  <div className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50">
                    <div className="text-[11px] font-semibold text-slate-400 px-3 py-1.5 uppercase tracking-wider">
                      Your Learning Goals
                    </div>
                    <div className="space-y-1">
                      {goals.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            selectGoal(g.id);
                            setShowGoalMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                            g.id === activeGoal.id
                              ? "bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20"
                              : "hover:bg-slate-800 text-slate-300"
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-medium">{g.title}</div>
                            <div className="text-[10px] text-slate-500">
                              {getDomainLabel(g.domainId)}
                            </div>
                          </div>
                          {g.id === activeGoal.id && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-800">
                      <Link
                        href="/"
                        onClick={() => setShowGoalMenu(false)}
                        className="block w-full text-center px-3 py-1.5 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-850 text-slate-300 font-medium transition-colors"
                      >
                        + Create New Goal
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : userId ? (
              <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 hidden md:inline">
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
                        ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <span className="text-xs">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
              <Link href="/#how-it-works" className="hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="/#differentiation" className="hover:text-white transition-colors">
                Why Knowra
              </Link>
              <Link href="/#curriculum" className="hover:text-white transition-colors">
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
                  className="flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 text-xs text-slate-300 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-sky-400 font-semibold">
                    👤
                  </div>
                  <span className="font-mono text-[11px] text-slate-300 max-w-[100px] truncate">
                    {userId}
                  </span>
                  <span className="text-slate-500 text-[10px]">▼</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-2xl z-50">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Authenticated Learner
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 mb-3 font-mono">
                      <div className="text-xs text-white truncate">
                        {userEmail || userId}
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Supabase Session Active</span>
                      </div>
                    </div>

                    {/* Sign Out Action (§31 Case F, §S8.3) */}
                    <div className="border-t border-slate-800 pt-2">
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
              <div className="flex items-center gap-2">
                <Link
                  href="/auth"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all"
                >
                  Start Learning
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        {userId && (
          <div className="md:hidden flex items-center justify-between py-2 border-t border-slate-800/60 overflow-x-auto gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200"
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
