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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              K
            </div>
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              {mode === "SIGN_UP" ? "Start Learning" : "Welcome Back"}
            </span>
          </div>
          <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {mode === "SIGN_UP" ? "Create your learner profile" : "Access your learning workspace"}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {mode === "SIGN_UP"
              ? "Knowra will map your starting point and personalize your Next Best Action."
              : "Resume your competency map and active recommendations."}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="learner-id-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Learner Identifier
            </label>
            <input
              id="learner-id-input"
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. alex-learns or dev_jordan"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Your unique identity ensures your verified evidence and mastery state persist across sessions.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50"
          >
            {loading ? "Connecting..." : mode === "SIGN_UP" ? "Start Learning →" : "Sign In →"}
          </button>
        </form>

        {/* Quick Demo Identities (§31) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            Or test with verified demo profiles
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo("test-learner-1")}
              className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-left transition-colors"
            >
              <div className="text-xs font-medium text-slate-200">test-learner-1</div>
              <div className="text-[10px] text-sky-400">Python Junior</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("test-learner-2")}
              className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-left transition-colors"
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
      </div>
    </div>
  );
}
