"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";
import { MasteryBadge } from "../components/ui/mastery-badge";
import { getCuratedCompetenciesByDomain } from "@/lib/learning/curriculum";
import { getDomain } from "@/lib/learning/domains";

interface CompetencyNode {
  id: string;
  domainId: string;
  title: string;
  description: string;
  category: "CONCEPTUAL" | "PROCEDURAL" | "FACTUAL";
  prerequisites: string[];
  difficulty: number;
  baselineScore: number;
  masteryScore: number;
  masteryState: string;
  confidence: number;
  evidenceCount: number;
  hasGap?: boolean;
  gapReason?: string;
  isFocus?: boolean;
  isUnlocked?: boolean;
}

interface StateComp {
  competencyId: string;
  baselineScore: number;
  masteryScore: number;
  masteryState?: string;
  confidence: number;
  evidenceCount: number;
}

interface RecommendationData {
  id: string;
  action: "LEARN" | "PRACTICE" | "FEYNMAN" | "REVIEW" | "REMEDIATE" | "RETRY" | "ADVANCE";
  competencyId: string;
  priority: number;
  reason: string;
  estimatedMinutes: number;
  status: string;
}

function getActionLabel(action?: string, hasPriorEvidence: boolean = false): string {
  switch (action) {
    case "LEARN":
      return hasPriorEvidence ? "Continue Learning" : "Start Learning";
    case "PRACTICE":
      return hasPriorEvidence ? "Continue Practice" : "Start Practice";
    case "FEYNMAN":
      return "Practice Feynman Technique";
    case "REVIEW":
      return "Start Review";
    case "REMEDIATE":
      return "Fix This Gap";
    case "RETRY":
      return "Try Again";
    case "ADVANCE":
      return "Continue to Next Competency";
    default:
      return "Start Practice";
  }
}

export default function LearningMapPage() {
  const router = useRouter();
  const { userId, activeGoal, goals, selectGoal, refreshGoals } = useLearner();
  const [nodes, setNodes] = useState<CompetencyNode[]>([]);
  const [filter, setFilter] = useState<"ALL" | "FOCUS" | "GAPS" | "MASTERED">("ALL");
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CompetencyNode | null>(null);
  const [diagnosticCompleted, setDiagnosticCompleted] = useState<boolean>(false);
  const [overallBaselineScore, setOverallBaselineScore] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<RecommendationData | null>(null);
  const [creatingCuratedGoal, setCreatingCuratedGoal] = useState<boolean>(false);

  const loadLearningMap = useCallback(async (goalId: string) => {
    setLoading(true);
    try {
      // 1. Fetch Authoritative Learner State (§17)
      const stateRes = await fetch(`/api/learning/state?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      const stateData = stateRes.ok ? await stateRes.json() : null;
      const isDiagDone = Boolean(stateData?.diagnosticCompleted);
      setDiagnosticCompleted(isDiagDone);
      setOverallBaselineScore(stateData?.overallBaselineScore ?? 0);

      // 2. Fetch Pedagogical Gaps (§22)
      const gapsRes = await fetch(`/api/learning/gaps?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      const gapsData = gapsRes.ok ? await gapsRes.json() : { gaps: [] };
      const gapsMap = new Map<string, string>();
      for (const g of gapsData.gaps || []) {
        if (g.status === "OPEN") {
          gapsMap.set(g.competencyId, g.reason);
        }
      }

      // 3. Fetch Engine Next Best Action Recommendation (§33)
      const recRes = await fetch(`/api/learning/recommendation?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      const recData = recRes.ok ? await recRes.json() : null;
      const rec = recData?.recommendation ?? null;
      setRecommendation(rec);
      const focusCompetencyId = rec?.competencyId;

      // 4. Assemble Curated Competencies from Curriculum Engine
      const stateCompsMap = new Map<string, StateComp>();
      for (const c of (stateData?.competencies || []) as StateComp[]) {
        stateCompsMap.set(c.competencyId, c);
      }

      const domainId = activeGoal?.domainId || "python-junior";
      const domainCompetencies = getCuratedCompetenciesByDomain(domainId);

      const mappedNodes: CompetencyNode[] = domainCompetencies.map((comp) => {
        const stateComp = stateCompsMap.get(comp.id);
        const baseline = stateComp?.baselineScore ?? 0;
        const mastery = stateComp?.masteryScore ?? 0;
        const confidence = stateComp?.confidence ?? 0.3;
        const evidenceCount = stateComp?.evidenceCount ?? 0;
        const masteryState =
          stateComp?.masteryState ??
          (mastery >= 85 ? "MASTERED" : mastery >= 65 ? "STRONG" : mastery > 0 ? "DEVELOPING" : "NOT_STARTED");

        // Check if prerequisites in graph are satisfied
        const prereqsSatisfied = comp.prerequisites.every((pid: string) => {
          const pComp = stateCompsMap.get(pid);
          return pComp && pComp.masteryScore >= 60;
        });

        return {
          id: comp.id,
          domainId,
          title: comp.title,
          description: comp.description,
          category: comp.category,
          prerequisites: comp.prerequisites,
          difficulty: comp.difficulty,
          baselineScore: baseline,
          masteryScore: mastery,
          masteryState,
          confidence,
          evidenceCount,
          hasGap: gapsMap.has(comp.id),
          gapReason: gapsMap.get(comp.id),
          isFocus: comp.id === focusCompetencyId,
          isUnlocked: comp.prerequisites.length === 0 || prereqsSatisfied,
        };
      });

      setNodes(mappedNodes);
      if (mappedNodes.length > 0) {
        const focusOrFirst = mappedNodes.find((n) => n.isFocus) || mappedNodes[0];
        setSelectedNode((prev) => (prev ? mappedNodes.find((n) => n.id === prev.id) || focusOrFirst : focusOrFirst));
      } else {
        setSelectedNode(null);
      }
    } catch {
      // Best-effort load
    } finally {
      setLoading(false);
    }
  }, [userId, activeGoal]);

  useEffect(() => {
    if (activeGoal) {
      loadLearningMap(activeGoal.id);
    }
  }, [activeGoal, loadLearningMap]);

  // Quick-create curated path when learner needs to start a supported goal
  const handleQuickCreateGoal = async (domainId: string, objective: string) => {
    if (!userId || creatingCuratedGoal) return;
    setCreatingCuratedGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          rawObjective: objective,
          selectedDomainId: domainId,
          selfReportedLevel: "Beginner",
        }),
      });

      if (res.ok) {
        const { goal } = await res.json();
        await refreshGoals();
        router.push(`/diagnostic?goalId=${goal.id}`);
      }
    } catch {
      // Failed
    } finally {
      setCreatingCuratedGoal(false);
    }
  };

  const domain = activeGoal ? getDomain(activeGoal.domainId) : undefined;
  const domainLabel = domain?.name || (activeGoal?.domainId === "python-junior" ? "Python Junior" : activeGoal?.domainId === "math-exams" ? "Mathematics" : activeGoal?.domainId === "excel-pro" ? "Excel Pro" : "Custom Domain");

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (filter === "FOCUS") return n.isFocus;
      if (filter === "GAPS") return n.hasGap;
      if (filter === "MASTERED") return n.masteryScore >= 80;
      return true;
    });
  }, [nodes, filter]);

  const masteredCount = useMemo(() => nodes.filter((n) => n.masteryScore >= 80).length, [nodes]);
  const gapCount = useMemo(() => nodes.filter((n) => n.hasGap).length, [nodes]);
  const recommendationNode = useMemo(() => nodes.find((n) => n.id === recommendation?.competencyId), [nodes, recommendation]);

  if (!activeGoal) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
        <LearnerNav />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.08] mx-auto flex items-center justify-center text-xl">
            🗺️
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">No Active Learning Goal</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tell Knowra what you want to learn to view your personalized competency map and starting diagnostic.
            </p>
          </div>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl font-bold text-xs bg-white text-[#07090e] hover:bg-slate-200 transition-all tracking-wide uppercase"
          >
            Create Learning Goal →
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      <LearnerNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ============================================================
            1. HEADER & GOAL SWITCHER (§5)
            ============================================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                {domainLabel}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-300 font-medium">{activeGoal.title}</span>
              {diagnosticCompleted && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Baseline: {overallBaselineScore.toFixed(0)}%
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Adaptive Learning Map
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Every card represents a foundational concept or procedure in your competency graph. Knowra adapts what you should learn next based on verified evidence.
            </p>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#0c1018] border border-white/[0.08] rounded-xl text-xs">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "ALL" ? "bg-white/10 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({nodes.length})
            </button>
            <button
              onClick={() => setFilter("FOCUS")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "FOCUS" ? "bg-sky-500/20 text-sky-300 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Focus
            </button>
            <button
              onClick={() => setFilter("GAPS")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "GAPS" ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Gaps ({gapCount})
            </button>
            <button
              onClick={() => setFilter("MASTERED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "MASTERED" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Mastered ({masteredCount})
            </button>
          </div>
        </div>

        {/* Goal Switcher Row (If multiple goals exist) */}
        {goals.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
            <span className="text-[11px] text-slate-500 uppercase shrink-0">Your Goals:</span>
            {goals.map((g) => (
              <button
                key={g.id}
                onClick={() => selectGoal(g.id)}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  g.id === activeGoal.id
                    ? "bg-white/15 text-white border border-white/20 font-semibold"
                    : "bg-[#0c1018] border border-white/[0.06] text-slate-400 hover:text-white"
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}

        {/* ============================================================
            2. CONTEXTUAL PRIMARY ACTION BANNER (§3, §4)
            ============================================================ */}
        {!diagnosticCompleted ? (
          /* --- STATE A: DIAGNOSTIC PENDING / REQUIRED --- */
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-[#0c1018] to-[#0c1018] p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Diagnostic Required
                </span>
                <span className="text-xs text-slate-400 font-mono">Calibrate Starting Baseline</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Calibrate what you already know before starting practice
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Knowra needs ~3 minutes to evaluate your prior knowledge in {domainLabel}. This establishes an immutable baseline, finds your prerequisite learning gaps, and unlocks personalized practice.
              </p>
            </div>
            <Link
              href={`/diagnostic?goalId=${activeGoal.id}`}
              className="shrink-0 px-6 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 uppercase tracking-wide"
            >
              <span>Start Diagnostic</span>
              <span>→</span>
            </Link>
          </div>
        ) : recommendation ? (
          /* --- STATE B: DIAGNOSTIC COMPLETED — NEXT BEST ACTION ACTIVE --- */
          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/30 via-[#0c1018] to-[#0c1018] p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Next Best Action • {recommendation.action}
                </span>
                <span className="text-xs text-slate-400 font-mono">Priority {recommendation.priority}</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {recommendationNode?.title || recommendation.competencyId}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {recommendation.reason}
              </p>
            </div>
            <Link
              href={`/activity?goalId=${activeGoal.id}&competencyId=${recommendation.competencyId}&action=${recommendation.action}&recId=${recommendation.id}`}
              className="shrink-0 px-6 py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2 uppercase tracking-wide"
            >
              <span>{getActionLabel(recommendation.action, (recommendationNode?.evidenceCount ?? 0) > 0)}</span>
              <span>→</span>
            </Link>
          </div>
        ) : null}

        {/* ============================================================
            3. UNSUPPORTED DOMAIN FALLBACK (§5)
            ============================================================ */}
        {nodes.length === 0 && !loading && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c1018] p-8 text-center space-y-6">
            <div className="space-y-2 max-w-xl mx-auto">
              <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Curriculum Not Seeded
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                This goal does not currently have a seeded curriculum graph.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Knowra provides full adaptive curricula with verified diagnostic baselines and activities for Python, Mathematics, and Excel. Select one of our curated learning paths to begin:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-2">
              <button
                type="button"
                disabled={creatingCuratedGoal}
                onClick={() =>
                  handleQuickCreateGoal("python-junior", "I want to learn Python from beginner to junior developer")
                }
                className="p-4 rounded-xl border border-white/[0.08] bg-[#07090e] hover:border-sky-500 hover:bg-sky-950/20 transition-all text-left space-y-2"
              >
                <div className="text-[10px] font-mono text-sky-400 uppercase">Curated Path 01</div>
                <div className="text-base font-bold text-white">Python Junior</div>
                <div className="text-xs text-slate-400">Variables, logic, functions, OOP, and testing.</div>
              </button>

              <button
                type="button"
                disabled={creatingCuratedGoal}
                onClick={() =>
                  handleQuickCreateGoal("math-exams", "I want to master Mathematics for exams and problem solving")
                }
                className="p-4 rounded-xl border border-white/[0.08] bg-[#07090e] hover:border-emerald-500 hover:bg-emerald-950/20 transition-all text-left space-y-2"
              >
                <div className="text-[10px] font-mono text-emerald-400 uppercase">Curated Path 02</div>
                <div className="text-base font-bold text-white">Mathematics</div>
                <div className="text-xs text-slate-400">Algebra, equations, trigonometry, and statistics.</div>
              </button>

              <button
                type="button"
                disabled={creatingCuratedGoal}
                onClick={() =>
                  handleQuickCreateGoal("excel-pro", "I want to achieve professional mastery in Excel and spreadsheets")
                }
                className="p-4 rounded-xl border border-white/[0.08] bg-[#07090e] hover:border-indigo-500 hover:bg-indigo-950/20 transition-all text-left space-y-2"
              >
                <div className="text-[10px] font-mono text-indigo-400 uppercase">Curated Path 03</div>
                <div className="text-base font-bold text-white">Excel Pro</div>
                <div className="text-xs text-slate-400">Formulas, XLOOKUP, Pivot Tables, and analysis.</div>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            4. COMPETENCY GRAPH & INSPECTOR (§8, §11)
            ============================================================ */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono">Traversing competency DAG and mastery states...</p>
          </div>
        ) : nodes.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Competency Graph Nodes (Left 2 Columns) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Learning Graph Nodes ({filteredNodes.length})
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredNodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                        isSelected
                          ? "border-sky-500 bg-sky-950/20 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500"
                          : node.isFocus
                          ? "border-sky-500/50 bg-[#0c1018] shadow-md shadow-sky-500/5"
                          : "border-white/[0.08] bg-[#0c1018]/60 hover:border-white/20 hover:bg-[#0c1018]"
                      }`}
                    >
                      {/* Current Focus Glow */}
                      {node.isFocus && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                          <span>Focus</span>
                        </div>
                      )}

                      {/* Gap Alert Tag */}
                      {node.hasGap && (
                        <div className="absolute top-2 right-2 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                          ⚠️ Gap
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-slate-500 uppercase">
                              {node.category}
                            </span>
                            <span className="text-slate-700">•</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Lvl {node.difficulty}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-white leading-tight">
                            {node.title}
                          </h3>
                        </div>

                        {/* Mastery Score Progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Mastery</span>
                            <span className="font-mono font-semibold text-slate-200">
                              {node.masteryScore.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/[0.04]">
                            <div
                              className={`h-full transition-all ${
                                node.masteryScore >= 80
                                  ? "bg-emerald-400"
                                  : node.masteryScore >= 50
                                  ? "bg-sky-400"
                                  : node.masteryScore > 0
                                  ? "bg-amber-400"
                                  : "bg-slate-800"
                              }`}
                              style={{ width: `${Math.max(4, node.masteryScore)}%` }}
                            />
                          </div>
                        </div>

                        {/* Confidence & Badges */}
                        <div className="flex items-center justify-between pt-1">
                          <MasteryBadge score={node.masteryScore} state={node.masteryState} size="sm" />
                          <span className="text-[10px] text-slate-500 font-mono">
                            Conf: {(node.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Node Inspector (Right Column) */}
            <div className="space-y-4">
              <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Competency Inspector
              </div>

              {selectedNode ? (
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c1018] p-6 space-y-5 sticky top-24 shadow-2xl">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-sky-400 uppercase">
                        {selectedNode.category}
                      </span>
                      {selectedNode.isFocus && (
                        <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30">
                          Current Recommended Focus
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white">{selectedNode.title}</h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedNode.description}
                    </p>
                  </div>

                  {/* Quantitative Metrics */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl border border-white/[0.06] bg-[#07090e]">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold font-mono">
                        Mastery Score
                      </div>
                      <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                        {selectedNode.masteryScore.toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold font-mono">
                        Baseline Score
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-300 mt-0.5">
                        {selectedNode.baselineScore.toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold font-mono">
                        Evidence Proofs
                      </div>
                      <div className="text-sm font-bold font-mono text-sky-400 mt-0.5">
                        {selectedNode.evidenceCount} verified
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold font-mono">
                        Confidence
                      </div>
                      <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                        {(selectedNode.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Prerequisites in DAG */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                      Prerequisites in Graph
                    </div>
                    {selectedNode.prerequisites.length > 0 ? (
                      <div className="space-y-1">
                        {selectedNode.prerequisites.map((pid) => (
                          <div
                            key={pid}
                            className="text-xs p-2 rounded-lg bg-[#07090e] border border-white/[0.04] flex items-center justify-between text-slate-300"
                          >
                            <span className="font-mono text-[11px]">{pid}</span>
                            <span className="text-[10px] text-emerald-400 font-medium font-mono">✓ Required</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic p-2 rounded bg-[#07090e] border border-white/[0.04]">
                        None (Root competency in DAG)
                      </div>
                    )}
                  </div>

                  {/* Active Gap Callout */}
                  {selectedNode.hasGap && (
                    <div className="p-3 rounded-xl border border-rose-900/40 bg-rose-950/20 space-y-1">
                      <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                        <span>⚠️ Active Pedagogical Gap</span>
                      </div>
                      <p className="text-xs text-rose-200">{selectedNode.gapReason}</p>
                    </div>
                  )}

                  {/* ==========================================================
                      CONTEXTUAL PRIMARY & SECONDARY ACTIONS (§3, §4)
                      ========================================================== */}
                  <div className="pt-2 space-y-2">
                    {!diagnosticCompleted ? (
                      /* If diagnostic has not been completed, direct to diagnostic */
                      <div className="space-y-2">
                        <Link
                          href={`/diagnostic?goalId=${activeGoal.id}`}
                          className="block w-full py-3 px-4 text-center rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all uppercase tracking-wide"
                        >
                          Start Diagnostic to Unlock Learning →
                        </Link>
                        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                          Your starting diagnostic is required to calibrate prior knowledge and calculate your Next Best Action.
                        </p>
                      </div>
                    ) : (
                      /* If diagnostic completed, contextual primary action */
                      <div className="space-y-2">
                        <Link
                          href={`/activity?goalId=${activeGoal.id}&competencyId=${selectedNode.id}&action=${
                            selectedNode.id === recommendation?.competencyId
                              ? recommendation.action
                              : selectedNode.hasGap
                              ? "REMEDIATE"
                              : selectedNode.masteryScore >= 80
                              ? "REVIEW"
                              : "PRACTICE"
                          }${selectedNode.id === recommendation?.competencyId && recommendation?.id ? `&recId=${recommendation.id}` : ""}`}
                          className="block w-full py-3 px-4 text-center rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20 transition-all uppercase tracking-wide"
                        >
                          {selectedNode.id === recommendation?.competencyId
                            ? `${getActionLabel(recommendation.action, selectedNode.evidenceCount > 0)} (Recommended) →`
                            : selectedNode.hasGap
                            ? "Fix This Gap →"
                            : selectedNode.masteryScore >= 80
                            ? "Review Competency →"
                            : "Practice This Competency →"}
                        </Link>

                        {/* Secondary action: Jump to Recommended Focus if another node is selected */}
                        {selectedNode.id !== recommendation?.competencyId && recommendation && (
                          <Link
                            href={`/activity?goalId=${activeGoal.id}&competencyId=${recommendation.competencyId}&action=${recommendation.action}&recId=${recommendation.id}`}
                            className="block w-full py-2 px-3 text-center rounded-lg text-xs font-medium text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-500/60 bg-sky-500/5 transition-all"
                          >
                            Go to Next Best Action: {recommendationNode?.title || recommendation.competencyId} →
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 border border-white/[0.08] rounded-xl bg-[#0c1018]">
                  Select a competency node to inspect mastery, confidence, and prerequisite relationships.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
