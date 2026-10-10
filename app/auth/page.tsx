"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase-browser";
import { KnowraHorizontalLogo } from "../components/brand-logo";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_UP");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    const supabase = createClient();

    try {
      if (mode === "SIGN_UP") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          router.push(redirectUrl);
          router.refresh();
        } else {
          setInfoMessage("Registration initiated. If confirmation is required, please check your inbox.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        router.push(redirectUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#161617] p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="space-y-3 text-center">
        <Link href="/" className="inline-flex justify-center mb-2">
          <KnowraHorizontalLogo className="h-8 w-auto text-[#F4F4F0]" />
        </Link>
        <h1 className="text-2xl font-light text-[#F4F4F0] tracking-tight">
          {mode === "SIGN_UP" ? "Start Learning." : "Sign In."}
        </h1>
        <p className="text-xs text-[#A3A3A3]">
          {mode === "SIGN_UP"
            ? "Knowra understands what you already know and adapts what you learn next."
            : "Resume your personalized competency graph and Next Best Action."}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {infoMessage && (
        <div className="p-3 rounded-lg border border-[#C95C3F]/30 bg-[#C95C3F]/10 text-[#C95C3F] text-xs font-mono">
          {infoMessage}
        </div>
      )}

      {/* Supabase Email + Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="auth-page-email-input" className="block font-mono text-[10px] text-[#A3A3A3] uppercase tracking-widest">
            Email Address
          </label>
          <input
            id="auth-page-email-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            className="w-full rounded-lg border border-white/[0.08] bg-[#0C0C0D] px-3.5 py-2.5 text-xs text-[#F4F4F0] placeholder-[#A3A3A3]/60 focus:outline-none focus:border-[#C95C3F] transition-all font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auth-page-password-input" className="block font-mono text-[10px] text-[#A3A3A3] uppercase tracking-widest">
            Password
          </label>
          <input
            id="auth-page-password-input"
            type="password"
            required
            autoComplete={mode === "SIGN_UP" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-white/[0.08] bg-[#0C0C0D] px-3.5 py-2.5 text-xs text-[#F4F4F0] placeholder-[#A3A3A3]/60 focus:outline-none focus:border-[#C95C3F] transition-all font-mono"
          />
          {mode === "SIGN_UP" && (
            <p className="text-[10px] text-[#A3A3A3] font-mono">
              Minimum 6 characters.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider text-[#0C0C0D] bg-[#F4F4F0] hover:bg-white transition-all disabled:opacity-50 shadow-md"
        >
          {loading ? "Authenticating..." : mode === "SIGN_UP" ? "Create Account →" : "Sign In →"}
        </button>
      </form>

      {/* Mode Toggle */}
      <div className="text-center text-xs text-[#A3A3A3] font-mono pt-2 border-t border-white/[0.06]">
        {mode === "SIGN_UP" ? (
          <span>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("SIGN_IN");
                setError(null);
                setInfoMessage(null);
              }}
              className="text-[#F4F4F0] hover:underline underline-offset-4"
            >
              Sign In
            </button>
          </span>
        ) : (
          <span>
            New to Knowra?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("SIGN_UP");
                setError(null);
                setInfoMessage(null);
              }}
              className="text-[#F4F4F0] hover:underline underline-offset-4"
            >
              Create Account
            </button>
          </span>
        )}
      </div>

      <div className="text-center pt-2">
        <Link href="/" className="text-xs font-mono text-[#A3A3A3] hover:text-[#F4F4F0]">
          ← Return to Knowra
        </Link>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#0C0C0D] text-[#F4F4F0] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-[#A3A3A3] text-xs font-mono">Loading authentication...</div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
