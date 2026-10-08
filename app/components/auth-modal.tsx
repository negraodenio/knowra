"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLearner } from "../lib/use-learner";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl?: string;
  initialMode?: "SIGN_IN" | "SIGN_UP";
}

export function AuthModal({
  isOpen,
  onClose,
  redirectUrl = "/",
  initialMode = "SIGN_UP",
}: AuthModalProps) {
  const router = useRouter();
  const { setUserId } = useLearner();
  const [mode, setMode] = useState<"SIGN_IN" | "SIGN_UP">(initialMode);
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Record signup_started telemetry when opened in signup mode
  useEffect(() => {
    if (isOpen) {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: mode === "SIGN_UP" ? "signup_started" : "landing_cta_clicked",
          payload: { mode, timestamp: new Date().toISOString() },
        }),
      }).catch(() => {
        // Observability best-effort
      });
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanId) {
      setError("Please provide a valid username or learner ID.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Record authentication handoff event
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
      onClose();
      if (redirectUrl && redirectUrl !== "/") {
        router.push(redirectUrl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoId: string) => {
    setUserId(demoId);
    onClose();
    if (redirectUrl && redirectUrl !== "/") {
      router.push(redirectUrl);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090e]/85 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0c1018] p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-white/5"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[4px] bg-white text-[#07090e] font-mono font-bold text-xs flex items-center justify-center">
              K
            </span>
            <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
              {mode === "SIGN_UP" ? "KNOWRA / ONBOARDING" : "KNOWRA / IDENTITY"}
            </span>
          </div>
          <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-light text-white tracking-tight">
            {mode === "SIGN_UP" ? "Create your learner profile." : "Access your learning workspace."}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            {mode === "SIGN_UP"
              ? "Knowra will map your starting point and personalize your Next Best Action."
              : "Resume your competency map and active recommendations."}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="learner-id-input" className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest">
              Learner Identifier
            </label>
            <input
              id="learner-id-input"
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. alex-learns or dev_jordan"
              className="w-full rounded-lg border border-white/[0.08] bg-[#07090e] px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-white/40 transition-all font-mono"
            />
            <p className="text-[10px] text-slate-500 font-mono">
              Your identifier persists your verified evidence and mastery state.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider text-[#07090e] bg-white hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            {loading ? "Connecting..." : mode === "SIGN_UP" ? "Start Learning →" : "Sign In →"}
          </button>
        </form>

        {/* Quick Demo Identities (§31) */}
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
            Or test with verified demo profiles
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
      </div>
    </div>
  );
}
