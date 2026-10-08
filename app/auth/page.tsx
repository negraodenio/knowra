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
    <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0c1018] p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="space-y-3 text-center">
        <Link href="/" className="inline-flex items-center gap-2 group mb-1">
          <span className="w-5 h-5 rounded-[4px] bg-white text-[#07090e] font-mono font-bold text-xs flex items-center justify-center">
            K
          </span>
          <span className="font-semibold text-sm tracking-[0.2em] text-white">
            KNOWRA
          </span>
        </Link>
        <h1 className="text-2xl font-light text-white tracking-tight">
          {mode === "SIGN_UP" ? "Start Learning." : "Sign In."}
        </h1>
        <p className="text-xs text-slate-400">
          {mode === "SIGN_UP"
            ? "Knowra understands what you already know and adapts what you learn next."
            : "Resume your personalized competency graph and Next Best Action."}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="auth-page-id-input" className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            Learner Identifier
          </label>
          <input
            id="auth-page-id-input"
            type="text"
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. alex-learns or dev_jordan"
            className="w-full rounded-lg border border-white/[0.08] bg-[#07090e] px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-white/40 transition-all font-mono"
          />
          <p className="text-[10px] text-slate-500 font-mono">
            Choose any identifier to persist your mastery states and evidence.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider text-[#07090e] bg-white hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          {loading ? "Authenticating..." : mode === "SIGN_UP" ? "Start Learning →" : "Sign In →"}
        </button>
      </form>

      {/* Quick Demo Identities */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
          Or try a pre-configured demo learner
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => handleQuickDemo("test-learner-1")}
            className="p-2.5 rounded border border-white/[0.06] bg-[#07090e] hover:border-white/20 text-left transition-colors"
          >
            <div className="text-xs text-white">test-learner-1</div>
            <div className="text-[10px] text-slate-400">Python Junior</div>
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo("test-learner-2")}
            className="p-2.5 rounded border border-white/[0.06] bg-[#07090e] hover:border-white/20 text-left transition-colors"
          >
            <div className="text-xs text-white">test-learner-2</div>
            <div className="text-[10px] text-slate-400">Mathematics</div>
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="text-center text-xs text-slate-500 font-mono">
        {mode === "SIGN_UP" ? (
          <span>
            Already have a profile?{" "}
            <button
              type="button"
              onClick={() => setMode("SIGN_IN")}
              className="text-white hover:underline underline-offset-4"
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
              className="text-white hover:underline underline-offset-4"
            >
              Create Profile
            </button>
          </span>
        )}
      </div>

      <div className="text-center pt-2">
        <Link href="/" className="text-xs font-mono text-slate-500 hover:text-slate-300">
          ← Return to Knowra
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
