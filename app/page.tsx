export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl w-full border border-slate-800 bg-slate-900/60 backdrop-blur-md rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">EDUIA Engine</h1>
            <p className="text-sm text-slate-400">Universal Adaptive Learning Platform</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Sprint 1: Ready
          </span>
        </div>

        <p className="text-slate-300 leading-relaxed text-sm">
          Core architectural thesis: <em>LLMs know things. The Learning Engine knows what the learner knows.</em> The engine models competencies, diagnoses baseline gaps, collects structured evidence, and dynamically schedules next best actions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-950/40">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">AI Gateway</h2>
            <p className="text-xs text-slate-300">OpenRouter client with task-to-model routing, Zod schema validation &amp; cost telemetry.</p>
          </div>
          <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-950/40">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Database &amp; RLS</h2>
            <p className="text-xs text-slate-300">Supabase PostgreSQL foundation with strict Row Level Security for complete learner isolation.</p>
          </div>
          <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-950/40">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Adaptive Engine</h2>
            <p className="text-xs text-slate-300">Deterministic mastery, evidence confidence, gap detection &amp; Next Best Action.</p>
          </div>
        </div>

        <div className="pt-2 text-xs text-slate-500 flex justify-between items-center border-t border-slate-800">
          <span>Sprint: S1 Foundation Baseline</span>
          <span>Status: Verified</span>
        </div>
      </div>
    </main>
  );
}
