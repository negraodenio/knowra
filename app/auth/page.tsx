"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLearner } from "../lib/use-learner";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const { setUserId } = useLearner();
  const [mode, setMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_UP");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanId) {
      setError("Please provide a valid username or learner ID.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "signup_started",
          anonymousId: cleanId,
          payload: { chosenId: cleanId, mode },
        }),
      }).catch(() => {});

      setUserId(cleanId);
      router.push(redirectUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoId: string) => {
    setUserId(demoId);
    router.push(redirectUrl);
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <Link href="/" className="inline-flex items-center gap-2 group mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm group-hover:scale-105 transition-transform">
            K
          </div>
          <span className="font-bold text-xl text-white tracking-tight">KNOWRA</span>
        </Link>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {mode === "SIGN_UP" ? "Start Learning" : "Sign In"}
        </h1>
        <p className="text-xs text-slate-400">
          {mode === "SIGN_UP"
            ? "Knowra understands what you already know and adapts what you learn next."
            : "Resume your personalized competency graph and Next Best Action."}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="auth-page-id-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Learner Identifier
          </label>
          <input
            id="auth-page-id-input"
            type="text"
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. alex-learns or dev_jordan"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
          />
          <p className="text-[11px] text-slate-500">
            Choose any handle to persist your mastery states and evidence.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50"
        >
          {loading ? "Authenticating..." : mode === "SIGN_UP" ? "Start Learning →" : "Sign In →"}
        </button>
      </form>

      {/* Quick Demo Identities */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">
          Or try a pre-configured demo learner
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickDemo("test-learner-1")}
            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-left transition-colors"
          >
            <div className="text-xs font-medium text-slate-200">test-learner-1</div>
            <div className="text-[10px] text-sky-400">Python Junior</div>
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo("test-learner-2")}
            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-left transition-colors"
          >
            <div className="text-xs font-medium text-slate-200">test-learner-2</div>
            <div className="text-[10px] text-indigo-400">Mathematics</div>
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="text-center text-xs text-slate-400">
        {mode === "SIGN_UP" ? (
          <span>
            Already have a profile?{" "}
            <button
              type="button"
              onClick={() => setMode("SIGN_IN")}
              className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2"
            >
              Sign In
            </button>
          </span>
        ) : (
          <span>
            New to Knowra?{" "}
            <button
              type="button"
              onClick={() => setMode("SIGN_UP")}
              className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2"
            >
              Create Profile
            </button>
          </span>
        )}
      </div>

      <div className="text-center pt-2">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
          ← Back to Knowra home
        </Link>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-xs">Loading authentication...</div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
