import React from "react";

export function MasteryBadge({
  score,
  state,
  size = "md",
}: {
  score?: number;
  state?: string;
  size?: "sm" | "md" | "lg";
}) {
  const normState = (state || "NOT_STARTED").toUpperCase();

  const colorConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
    NOT_STARTED: {
      bg: "bg-slate-800/60",
      text: "text-slate-400",
      border: "border-slate-700/50",
      label: "Not Started",
    },
    IN_PROGRESS: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
      label: "In Progress",
    },
    DEVELOPING: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      label: "Developing",
    },
    STRONG: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      label: "Strong",
    },
    MASTERED: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
      border: "border-indigo-500/30",
      label: "Mastered",
    },
  };

  const config = colorConfig[normState] || colorConfig.NOT_STARTED;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{config.label}</span>
      {typeof score === "number" && (
        <span className="font-mono opacity-90 ml-0.5">({score.toFixed(0)}%)</span>
      )}
    </span>
  );
}
