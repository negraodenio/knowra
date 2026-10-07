# Sprint 5 — Adaptive Loop: Recommendations + Next Best Action + Adaptive Learning Plan

**Specification:** Master Product Business Technical Specification v3.1  
**Sprint:** 5 (Adaptive Loop)  
**Status:** Implemented & Validated  
**Algorithm Version:** `v1`  
**Core Architectural Thesis:**  
> *"LLMs know things. The Learning Engine knows what the learner knows, and what they should do next."*

---

## 1. Executive Summary

Sprint 4 answered: **WHAT DOES THE LEARNER CURRENTLY KNOW?**  
Sprint 5 answers: **WHAT SHOULD THE LEARNER DO NEXT?**

The Adaptive Loop connects learner state directly to instructional decision-making:
```
LEARNING STATE
      ↓
OPEN GAPS
      ↓
PREREQUISITES (DAG)
      ↓
MASTERY
      ↓
CONFIDENCE
      ↓
OBJECTIVE
      ↓
RECOMMENDATION
      ↓
NEXT BEST ACTION
      ↓
LEARNER ACTION
      ↓
NEW EVIDENCE
      ↓
UPDATED LEARNING STATE
      ↓
NEW RECOMMENDATION
```

---

## 2. Next Best Action Taxonomy

The engine strictly uses the approved 7-action closed enum:

```typescript
export type NextBestAction =
  | "LEARN"
  | "PRACTICE"
  | "FEYNMAN"
  | "REVIEW"
  | "REMEDIATE"
  | "RETRY"
  | "ADVANCE";
```

No arbitrary action types or ad-hoc states are permitted.

---

## 3. Action Decision Rules (Deterministic)

The action evaluator does **not** query an LLM. It computes decisions deterministically using the full multi-factor learner state:

| Action | Condition & Triggers | Category Affinity | Estimated Time |
| :--- | :--- | :--- | :--- |
| **`REMEDIATE`** | Open gap exists ($\ge 2$ independent failure signals) or persistent low mastery with failure history blocking downstream nodes. | All | 25 min |
| **`RETRY`** | Recent attempt failed, but evidence is insufficient to declare an established gap ($< 2$ signals). Another attempt clarifies learner state. | All | 15 min |
| **`REVIEW`** | Evidence indicates knowledge decay: previously developed/good mastery ($\ge 65$), but last evidence is aged ($\ge 14$ days). | All | 10 min |
| **`PRACTICE`** | Developing mastery ($60 \le M < 75$) or high mastery with low confidence ($M \ge 75, C < 0.65$) on procedural/factual competencies. | `PROCEDURAL`, `FACTUAL` | 20 min |
| **`FEYNMAN`** | Developing mastery or high mastery with limited confidence on conceptual competencies. Validates deep understanding. | `CONCEPTUAL` | 15 min |
| **`LEARN`** | Initial instruction: low/zero mastery ($M < 60$), no prior failed attempts, unblocked by prerequisites. | All | 25 min |
| **`ADVANCE`** | Milestone reached: $M \ge 75$ and $C \ge 0.65$ with all prerequisite constraints satisfied. Terminal progression. | All | 20 min |

### Conflicting Signal Handling:
- **High Mastery + Low Confidence ($M = 80\%, C = 35\%$):** Does **not** advance. Recommends `PRACTICE` (for procedural) or `FEYNMAN` (for conceptual) to confirm understanding.
- **Low Mastery + High Confidence ($M = 35\%, C = 85\%$, Open Gap):** Recommends `REMEDIATE`.
- **Low Mastery + Low Confidence ($M = 40\%, C = 30\%$):** If recent failure: `RETRY`. If no prior attempts: `LEARN`.

---

## 4. Deterministic Priority Model (0–100)

Priority is calculated using a transparent 6-factor model normalized to $[0, 100]$:

$$\text{Priority} = w_{\text{gap}} + w_{\text{prereq}} + w_{\text{deficit}} + w_{\text{obj}} + w_{\text{recency}} + w_{\text{deadline}}$$

```typescript
export interface RecommendationWeightsConfig {
  gapCriticalWeight: 30,             // Max 30 pts for CRITICAL gap (HIGH: 24, MED: 16, LOW: 8)
  gapHighWeight: 24,
  gapMediumWeight: 16,
  gapLowWeight: 8,

  downstreamPerDependentWeight: 5,   // Max 25 pts (5 pts per downstream dependent node)
  maxPrerequisiteImpactWeight: 25,

  masteryDeficitWeight: 20,          // Max 20 pts scaled by (target - current) / target
  targetMastery: 75,

  objectiveMatchWeight: 15,          // 15 pts for direct scope/outcome match; 10 pts for domain match
  domainMatchWeight: 10,

  recencyWeight: 5,                  // 5 pts for immediate retry/remediation/review need

  deadlineWeight: 5,                 // 5 pts for tight deadline (<= 7 days remaining)
}
```

### Prerequisite Impact Example:
- **Competency A:** Mastery $50\%$, blocks 5 downstream competencies $\rightarrow$ receives $25$ prerequisite impact points.
- **Competency B:** Mastery $50\%$, blocks 0 downstream competencies $\rightarrow$ receives $0$ prerequisite impact points.
- **Outcome:** Competency A has significantly higher priority, correctly preventing curriculum bottlenecks.

---

## 5. Prerequisite DAG Blocking & Eligibility

The engine checks prerequisite blocking using configurable thresholds:
```typescript
export interface PrerequisiteBlockConfig {
  minimumMastery: 75;
  minimumConfidence: 0.65;
  blockingGapSeverities: ["CRITICAL", "HIGH"];
}
```

- `isBlockedByPrerequisite(comp, states, gaps, config)`: Returns true if any direct prerequisite has $M < 75$, $C < 0.65$, or an active CRITICAL/HIGH gap.
- `getBlockingPrerequisites(comp, states, gaps, config)`: Returns detailed diagnostic reasons for each blocker.
- `getEligibleCompetencies(states, gaps, config)`: Discovers all currently unblocked, ready-to-learn competencies across the graph.

---

## 6. Explainability: Deterministic Reason Generation

Every recommendation includes a 100% data-derived explanation. Zero LLM hallucinations.

**Examples:**
- *Remediation:* `"Python Functions has 48% current mastery with an open HIGH gap (2 failure signals). It blocks 3 downstream competencies. Remediation is required to restore competency baseline."`
- *Retry:* `"Recent attempt on Excel VLOOKUP was unsuccessful (score: 40%) without an established gap; an immediate retry will clarify your state."`
- *Review:* `"Evidence indicates knowledge decay for Linear Equations (21 days since last assessment). A targeted review will reinforce retention."`
- *Feynman:* `"Python Recursion is a conceptual competency with developing mastery (64%). Explaining core mechanisms using the Feynman technique will eliminate latent confusion."`

---

## 7. Dynamic Adaptive Learning Plan

The Adaptive Learning Plan is **not** a static syllabus. It is a dynamic projection reconstructed on-the-fly from the current learner state, open gaps, and topological DAG ordering.

```typescript
export interface AdaptiveLearningPlan {
  goalId: string;
  domainId: string;
  targetOutcome: string;
  generatedAt: string;
  algorithmVersion: "v1";
  totalEstimatedMinutes: number;
  completedStepsCount: number;
  activeStep?: PlanStep;
  steps: PlanStep[];
}
```

Whenever learner evidence or mastery updates, calling `getAdaptiveLearningPlan()` regenerates the plan dynamically, ensuring plans never become stale.

---

## 8. Recommendation Lifecycle & Invalidation

### Lifecycle States:
$$\text{PENDING} \longrightarrow \text{PRESENTED} \longrightarrow \text{ACCEPTED} \longrightarrow \text{COMPLETED}$$
$$\text{PENDING} \longrightarrow \text{PRESENTED} \longrightarrow \text{SKIPPED}$$
$$\text{PENDING / PRESENTED} \overset{\text{state change}}{\longrightarrow} \text{EXPIRED}$$

### Core Invariants:
1. **Acceptance is NOT evidence:** Accepting a recommendation records the learner's intent (`accepted_at`), but produces **zero** learning evidence.
2. **Completion does NOT fabricate evidence:** Marking a recommendation completed audits the recommendation record, but learning evidence is only recorded by real instructional activities.
3. **Stale recommendation expiration:** If a learner masters a competency through external practice while a previous recommendation was active, the engine marks the old recommendation `EXPIRED` and generates a fresh recommendation.

---

## 9. Security & Data Isolation

- Cross-user security tests verify that User B cannot read, accept, skip, or complete User A's recommendations, nor view User A's adaptive plan.
- Violations throw `UnauthorizedAccessError` and return HTTP `403 Forbidden`.
- Row-Level Security (RLS) is enforced in PostgreSQL on `public.recommendations`.

---

## 10. Database Migration

Migration `supabase/migrations/20261007000003_s5_adaptive_loop.sql`:
- Extends `public.recommendations` with `learning_goal_id`, `algorithm_version`, `generated_at`, `presented_at`, `accepted_at`, `skipped_at`, `completed_at`.
- Updates `priority` column to `NUMERIC(5, 2)` (0–100 score representation).
- Updates check constraint to include all 6 lifecycle statuses (`PENDING`, `PRESENTED`, `ACCEPTED`, `SKIPPED`, `COMPLETED`, `EXPIRED`).
- Creates query indexes on `(learning_goal_id)` and `(user_id, learning_goal_id, status)`.

---

## 11. Verification Summary

- **Unit & Integration Tests:** 17 test files, 109 tests passing (`npm run test`).
- **TypeScript:** Strict typecheck passing without errors (`npm run typecheck`).
- **ESLint:** Clean without warnings (`npm run lint`).
- **Next.js Production Build:** 16 routes statically and dynamically compiled (`npm run build`).
