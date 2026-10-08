"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnerNav } from "../components/learner-nav";
import { useLearner } from "../lib/use-learner";
import { MasteryBadge } from "../components/ui/mastery-badge";

interface CompetencyNode {
  id: string;
  domainId: string;
  title: string;
  description: string;
  category: "CONCEPTUAL" | "PROCEDURAL";
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

interface DomainCompDef {
  id: string;
  title: string;
  category: "CONCEPTUAL" | "PROCEDURAL";
  prereqs: string[];
  difficulty: number;
  desc: string;
}

export default function LearningMapPage() {
  const { userId, activeGoal } = useLearner();
  const [nodes, setNodes] = useState<CompetencyNode[]>([]);
  const [filter, setFilter] = useState<"ALL" | "FOCUS" | "GAPS" | "MASTERED">("ALL");
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CompetencyNode | null>(null);

  const loadLearningMap = useCallback(async (goalId: string) => {
    setLoading(true);
    try {
      // 1. Fetch State
      const stateRes = await fetch(`/api/learning/state?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      const stateData = stateRes.ok ? await stateRes.json() : null;

      // 2. Fetch Gaps
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

      // 3. Fetch Recommendation for Current Focus
      const recRes = await fetch(`/api/learning/recommendation?goalId=${goalId}`, {
        headers: { "x-user-id": userId },
      });
      const recData = recRes.ok ? await recRes.json() : null;
      const focusCompetencyId = recData?.recommendation?.competencyId;

      // 4. Fetch Curated Domain Competencies
      const stateCompsMap = new Map<string, StateComp>();
      for (const c of (stateData?.competencies || []) as StateComp[]) {
        stateCompsMap.set(c.competencyId, c);
      }

      const domainId = activeGoal?.domainId || "python-junior";
      let domainCompetencies: DomainCompDef[] = [];

      if (domainId === "python-junior") {
        domainCompetencies = [
          { id: "py-variables-types", title: "Variables & Primitive Types", category: "CONCEPTUAL", prereqs: [], difficulty: 1, desc: "Understanding memory assignment and primitive data types." },
          { id: "py-operators-expressions", title: "Operators & Expressions", category: "PROCEDURAL", prereqs: ["py-variables-types"], difficulty: 1, desc: "Arithmetic, comparison, and boolean logical operators." },
          { id: "py-conditionals", title: "Conditional Branching", category: "CONCEPTUAL", prereqs: ["py-operators-expressions"], difficulty: 2, desc: "Decision making using if, elif, and else statements." },
          { id: "py-loops-iteration", title: "Loops & Iteration", category: "PROCEDURAL", prereqs: ["py-conditionals"], difficulty: 2, desc: "Iteration with for and while loops, break and continue." },
          { id: "py-functions-scope", title: "Functions & Variable Scope", category: "CONCEPTUAL", prereqs: ["py-conditionals"], difficulty: 3, desc: "Function definitions, parameters, return values, and LEGB scope." },
          { id: "py-data-structures-lists-tuples", title: "Lists & Tuples", category: "PROCEDURAL", prereqs: ["py-loops-iteration", "py-functions-scope"], difficulty: 3, desc: "Sequential collections, indexing, slicing, and mutability." },
          { id: "py-data-structures-dicts-sets", title: "Dictionaries & Sets", category: "CONCEPTUAL", prereqs: ["py-data-structures-lists-tuples"], difficulty: 3, desc: "Key-value mapping, hashability, and unique set operations." },
          { id: "py-error-handling", title: "Error & Exception Handling", category: "PROCEDURAL", prereqs: ["py-functions-scope"], difficulty: 3, desc: "Handling runtime exceptions with try, except, finally." },
          { id: "py-file-io", title: "File Input & Output", category: "PROCEDURAL", prereqs: ["py-error-handling", "py-data-structures-dicts-sets"], difficulty: 3, desc: "Reading and writing files with context managers." },
          { id: "py-oop-basics", title: "OOP Basics", category: "CONCEPTUAL", prereqs: ["py-functions-scope", "py-data-structures-dicts-sets"], difficulty: 4, desc: "Classes, objects, constructors (__init__), and encapsulation." },
          { id: "py-testing-debugging", title: "Unit Testing & Debugging", category: "PROCEDURAL", prereqs: ["py-oop-basics", "py-error-handling"], difficulty: 4, desc: "Writing unit tests with assert and debugging." },
        ];
      } else if (domainId === "math-exams") {
        domainCompetencies = [
          { id: "math-algebraic-expressions", title: "Algebraic Expressions", category: "CONCEPTUAL", prereqs: [], difficulty: 1, desc: "Evaluating expressions, combining like terms, and factoring." },
          { id: "math-linear-equations", title: "Linear Equations", category: "PROCEDURAL", prereqs: ["math-algebraic-expressions"], difficulty: 2, desc: "Solving single-variable linear equations." },
          { id: "math-linear-systems", title: "Linear Systems", category: "PROCEDURAL", prereqs: ["math-linear-equations"], difficulty: 3, desc: "Two-variable linear systems via substitution and elimination." },
          { id: "math-quadratic-equations", title: "Quadratic Equations", category: "CONCEPTUAL", prereqs: ["math-algebraic-expressions"], difficulty: 3, desc: "Factoring quadratic trinomials and quadratic formula." },
          { id: "math-functions-graphs", title: "Functions & Graphs", category: "CONCEPTUAL", prereqs: ["math-linear-systems", "math-quadratic-equations"], difficulty: 3, desc: "Function notation, slope-intercept form, and vertices." },
          { id: "math-trigonometry-ratios", title: "Trigonometric Ratios", category: "CONCEPTUAL", prereqs: ["math-algebraic-expressions"], difficulty: 3, desc: "Sine, cosine, and tangent in right triangles; Pythagorean theorem." },
          { id: "math-coordinate-geometry", title: "Coordinate Geometry", category: "PROCEDURAL", prereqs: ["math-functions-graphs", "math-trigonometry-ratios"], difficulty: 4, desc: "Distance formula, midpoint, parallel and perpendicular lines." },
          { id: "math-probability-statistics", title: "Probability & Statistics", category: "CONCEPTUAL", prereqs: ["math-algebraic-expressions"], difficulty: 2, desc: "Sample spaces, mean, median, mode, variance, and standard deviation." },
        ];
      } else {
        domainCompetencies = [
          { id: "xl-navigation-basics", title: "Workbook Navigation & Formatting", category: "PROCEDURAL", prereqs: [], difficulty: 1, desc: "Cell references ($A$1), cell formatting, keyboard shortcuts." },
          { id: "xl-core-math-functions", title: "Basic Aggregations (SUM, AVG)", category: "PROCEDURAL", prereqs: ["xl-navigation-basics"], difficulty: 1, desc: "SUM, AVERAGE, MIN, MAX, and COUNT over ranges." },
          { id: "xl-logical-formulas", title: "Logical Formulas (IF, AND, OR)", category: "CONCEPTUAL", prereqs: ["xl-core-math-functions"], difficulty: 2, desc: "Single and nested IF statements, boolean logic." },
          { id: "xl-conditional-math", title: "Conditional Math (SUMIFS, COUNTIFS)", category: "PROCEDURAL", prereqs: ["xl-logical-formulas"], difficulty: 2, desc: "Filtering calculations by multiple criteria." },
          { id: "xl-lookup-functions", title: "Lookups (XLOOKUP, INDEX/MATCH)", category: "PROCEDURAL", prereqs: ["xl-logical-formulas"], difficulty: 3, desc: "Modern search with XLOOKUP and INDEX/MATCH." },
          { id: "xl-text-data-cleaning", title: "Text Cleaning & Manipulation", category: "PROCEDURAL", prereqs: ["xl-navigation-basics"], difficulty: 2, desc: "TRIM, CLEAN, CONCAT, TEXTJOIN, LEFT, and Flash Fill." },
          { id: "xl-pivot-tables", title: "Pivot Tables & Summaries", category: "PROCEDURAL", prereqs: ["xl-conditional-math", "xl-text-data-cleaning"], difficulty: 3, desc: "Creating Pivot Tables, dynamic aggregation, and slicing." },
          { id: "xl-visualization-validation", title: "Visualization & Data Validation", category: "PROCEDURAL", prereqs: ["xl-pivot-tables", "xl-lookup-functions"], difficulty: 3, desc: "Dynamic charts, conditional formatting, and dropdown validation." },
        ];
      }

      const mappedNodes: CompetencyNode[] = domainCompetencies.map((comp) => {
        const stateComp = stateCompsMap.get(comp.id);
        const baseline = stateComp?.baselineScore ?? 0;
        const mastery = stateComp?.masteryScore ?? 0;
        const confidence = stateComp?.confidence ?? 0.3;
        const evidenceCount = stateComp?.evidenceCount ?? 0;
        const masteryState = stateComp?.masteryState ?? (mastery >= 85 ? "MASTERED" : mastery >= 65 ? "STRONG" : mastery > 0 ? "DEVELOPING" : "NOT_STARTED");

        // Check if prerequisites are satisfied
        const prereqsSatisfied = comp.prereqs.every((pid: string) => {
          const pComp = stateCompsMap.get(pid);
          return pComp && pComp.masteryScore >= 60;
        });

        return {
          id: comp.id,
          domainId,
          title: comp.title,
          description: comp.desc,
          category: comp.category,
          prerequisites: comp.prereqs,
          difficulty: comp.difficulty,
          baselineScore: baseline,
          masteryScore: mastery,
          masteryState,
          confidence,
          evidenceCount,
          hasGap: gapsMap.has(comp.id),
          gapReason: gapsMap.get(comp.id),
          isFocus: comp.id === focusCompetencyId,
          isUnlocked: comp.prereqs.length === 0 || prereqsSatisfied,
        };
      });

      setNodes(mappedNodes);
      if (mappedNodes.length > 0) {
        const focusOrFirst = mappedNodes.find((n) => n.isFocus) || mappedNodes[0];
        setSelectedNode(focusOrFirst);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [userId, activeGoal]);

  useEffect(() => {
    if (activeGoal) {
      loadLearningMap(activeGoal.id);
    }
  }, [activeGoal, loadLearningMap]);

  if (!activeGoal) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <LearnerNav />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">No Active Learning Goal</h2>
          <p className="text-sm text-slate-400">
            Tell Knowra what you want to learn to view your personalized competency map.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl font-semibold text-xs bg-sky-500 text-white"
          >
            Create Goal →
          </Link>
        </main>
      </div>
    );
  }

  const filteredNodes = nodes.filter((n) => {
    if (filter === "FOCUS") return n.isFocus;
    if (filter === "GAPS") return n.hasGap;
    if (filter === "MASTERED") return n.masteryScore >= 80;
    return true;
  });

  const masteredCount = nodes.filter((n) => n.masteryScore >= 80).length;
  const gapCount = nodes.filter((n) => n.hasGap).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LearnerNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header & Map Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Competency Graph
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">{activeGoal.title}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Your Adaptive Learning Map
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Every card represents a key topic in your personalized learning journey. The Learning Engine adapts your path based on verified evidence.
            </p>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({nodes.length})
            </button>
            <button
              onClick={() => setFilter("FOCUS")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "FOCUS" ? "bg-sky-500/20 text-sky-300" : "text-slate-400 hover:text-white"
              }`}
            >
              Current Focus
            </button>
            <button
              onClick={() => setFilter("GAPS")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "GAPS" ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:text-white"
              }`}
            >
              Gaps ({gapCount})
            </button>
            <button
              onClick={() => setFilter("MASTERED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === "MASTERED" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"
              }`}
            >
              Mastered ({masteredCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Traversing competency DAG and mastery states...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Competency Graph Nodes (Left 2 Columns) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                          ? "border-sky-500/50 bg-slate-900/80 shadow-md shadow-sky-500/5"
                          : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
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
                            <span className="text-[10px] text-slate-500">
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
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                node.masteryScore >= 80
                                  ? "bg-emerald-400"
                                  : node.masteryScore >= 50
                                  ? "bg-sky-400"
                                  : node.masteryScore > 0
                                  ? "bg-amber-400"
                                  : "bg-slate-700"
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
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Competency Inspector
              </div>

              {selectedNode ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 sticky top-24">
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
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/70">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        Mastery Score
                      </div>
                      <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                        {selectedNode.masteryScore.toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        Baseline Score
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-300 mt-0.5">
                        {selectedNode.baselineScore.toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        Evidence Proofs
                      </div>
                      <div className="text-sm font-bold font-mono text-sky-400 mt-0.5">
                        {selectedNode.evidenceCount} verified
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        Confidence
                      </div>
                      <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                        {(selectedNode.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Prerequisites in DAG */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Prerequisites in Graph
                    </div>
                    {selectedNode.prerequisites.length > 0 ? (
                      <div className="space-y-1">
                        {selectedNode.prerequisites.map((pid) => (
                          <div
                            key={pid}
                            className="text-xs p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-slate-300"
                          >
                            <span className="font-mono text-[11px]">{pid}</span>
                            <span className="text-[10px] text-emerald-400 font-medium">✓ Required</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic p-2 rounded bg-slate-950 border border-slate-800">
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

                  {/* Direct Activity Action */}
                  <div className="pt-2">
                    <Link
                      href={`/activity?goalId=${activeGoal.id}&competencyId=${selectedNode.id}&action=PRACTICE`}
                      className="block w-full py-2.5 px-4 text-center rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20 transition-all"
                    >
                      Practice This Competency →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-slate-900/30">
                  Select a competency node to inspect mastery, confidence, and prerequisite relationships.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
