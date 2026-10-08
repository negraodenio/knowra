import React from "react";

export interface GapData {
  id: string;
  competencyId: string;
  severity: number | string;
  reason: string;
  status: string;
  competencyTitle?: string;
  recommendedAction?: string;
}

export function GapAlert({ gap }: { gap: GapData }) {
  const isCritical =
    gap.severity === "CRITICAL" ||
    (typeof gap.severity === "number" && gap.severity >= 0.8);
  const isHigh =
    gap.severity === "HIGH" ||
    (typeof gap.severity === "number" && gap.severity >= 0.6 && gap.severity < 0.8);

  const badgeColor = isCritical
    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
    : isHigh
    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

  const severityText = isCritical
    ? "Critical Gap"
    : isHigh
    ? "High Priority Gap"
    : "Moderate Gap";

  return (
    <div className="rounded-xl border border-rose-900/40 bg-gradient-to-r from-rose-950/30 via-slate-900/60 to-slate-900/40 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 text-lg">⚠️</div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                {severityText}
              </span>
              <span className="text-xs font-semibold text-slate-200">
                {gap.competencyTitle || gap.competencyId}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{gap.reason}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
