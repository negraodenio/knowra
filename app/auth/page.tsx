"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase-browser";

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
        // Telemetry
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "signup_started",
            payload: { email: cleanEmail, mode },
          }),
        }).catch(() => {});

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.user && !data.session) {
          setInfoMessage("Account created. Please check your email to confirm your account, then sign in.");
          setMode("SIGN_IN");
          return;
        }

        if (data.session && data.user) {
          try {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              email: cleanEmail,
              updated_at: new Date().toISOString(),
            });
          } catch {
            // Non-blocking profile initialization
          }
        }

        router.push(redirectUrl);
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        if (data.session) {
          router.push(redirectUrl);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
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
        <p className="text-xs text-zinc-400">
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

      {infoMessage && (
        <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-mono">
          {infoMessage}
        </div>
      )}

      {/* Supabase Email + Password Form (§S8.3) */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="auth-page-email-input" className="block font-mono text-[10px] text-zinc-400 uppercase tracking-widest">
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
            className="w-full rounded-lg border border-white/[0.08] bg-[#07090e] px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 transition-all font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auth-page-password-input" className="block font-mono text-[10px] text-zinc-400 uppercase tracking-widest">
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
            className="w-full rounded-lg border border-white/[0.08] bg-[#07090e] px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 transition-all font-mono"
          />
          {mode === "SIGN_UP" && (
            <p className="text-[10px] text-zinc-500 font-mono">
              Minimum 6 characters.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider text-[#07090e] bg-white hover:bg-zinc-200 transition-all disabled:opacity-50"
        >
          {loading ? "Authenticating..." : mode === "SIGN_UP" ? "Create Account →" : "Sign In →"}
        </button>
      </form>

      {/* Mode Toggle */}
      <div className="text-center text-xs text-zinc-500 font-mono pt-2 border-t border-white/[0.06]">
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
              onClick={() => {
                setMode("SIGN_UP");
                setError(null);
                setInfoMessage(null);
              }}
              className="text-white hover:underline underline-offset-4"
            >
              Create Account
            </button>
          </span>
        )}
      </div>

      <div className="text-center pt-2">
        <Link href="/" className="text-xs font-mono text-zinc-500 hover:text-zinc-300">
          ← Return to Knowra
        </Link>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-zinc-400 text-xs font-mono">Loading authentication...</div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
