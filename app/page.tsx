import { DiagnosticFlow } from "./diagnostic-client";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-4xl w-full border border-slate-800 bg-slate-900/60 backdrop-blur-md rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">EDUIA Engine</h1>
            <p className="text-sm text-slate-400">Universal Adaptive Learning Platform</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Sprint 3: Diagnostic &amp; Learner State
          </span>
        </div>

        <p className="text-slate-300 leading-relaxed text-sm">
          Core architectural thesis: <em>LLMs know things. The Learning Engine knows what the learner knows.</em> S3 establishes the initial baseline state through calibrated diagnostic evidence across the 3 curated MVP domains.
        </p>

        {/* Minimal Learner Diagnostic Flow (§38) */}
        <DiagnosticFlow />

        <div className="pt-4 text-xs text-slate-500 flex justify-between items-center border-t border-slate-800">
          <span>Sprint: S3 Diagnostic + Learning State</span>
          <span>Status: Verified</span>
        </div>
      </div>
    </main>
  );
}
