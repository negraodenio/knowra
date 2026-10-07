# DIAGNOSTIC + LEARNING STATE SPECIFICATION & ARCHITECTURE (SPRINT 3)

**Version:** 1.0  
**Status:** Approved for Implementation  
**Product Reference:** Master Specification v3.1 (§9, §10, §11, §13, §14, §15, §18, §19, §20, §25, §36)  

---

## 1. Overview & Product Thesis

Sprint 2 established **"What can be learned?"** (Domains, Competencies, Prerequisite DAGs).  
Sprint 3 establishes **"What does this learner already know?"** (Initial Diagnostic Evidence, Baseline Scores, Initial Confidence, and Learner Profile).

### Core Flow
```
LEARNER
  ↓
GOAL & DOMAIN
  ↓
OBJECTIVE NORMALIZATION
  ↓
DIAGNOSTIC SESSION (Map Version Frozen)
  ↓
DETERMINISTIC EVALUATION
  ↓
APPEND-ONLY EVIDENCE RECORD
  ↓
BASELINE STATE & INITIAL CONFIDENCE
```

---

## 2. Onboarding & Learning Goal

1. **Learning Goal (`learning_goals`):**
   * Associates `user_id` with `domain_id` (must exist in S2 curated domains: `python-junior`, `math-exams`, `excel-pro`).
   * Captures raw objective string and normalized objective structure.
   * Scoped strictly by `user_id` via Supabase Row Level Security (RLS).
2. **Objective Normalizer (`lib/learning/objective-normalizer.ts`):**
   * Transforms natural language input into structured Zod schema: `{ domainId, targetOutcome, scope, level, deadline, clarificationNeeded }`.
   * Enforces domain boundaries (does not invent arbitrary domains).
   * Flags `clarificationNeeded: true` when input is ambiguous.

---

## 3. Diagnostic Item & Pool Architecture

* **Deterministic Item Pool (`lib/learning/diagnostic/curriculum/`):**
  * Seeded with calibrated items for Python, Mathematics, and Excel.
  * Every item maps directly to an active S2 competency ID (0 dangling references).
  * Supports item types: `MULTIPLE_CHOICE`, `SHORT_ANSWER`, `NUMERIC`, `TRUE_FALSE`.
  * Difficulty calibrated on a 1–5 scale matching S2 competency difficulty.
* **Deterministic Item Evaluator (`lib/learning/diagnostic/evaluator.ts`):**
  * Evaluates responses without relying on LLM hallucination for closed formats.
  * Tolerates whitespace and case differences, with epsilon tolerance for floating-point values.

---

## 4. Evidence Model & Baseline Score Preservation

* **Append-Only Evidence (`evidence`):**
  * Diagnostic responses are transformed into records with `evidence_type = 'DIAGNOSTIC'`.
  * Never overwritten or updated in place.
* **Baseline Score vs Mastery Score:**
  * S3 explicitly does **NOT** implement the final mastery engine (§16) or gap detection (§18).
  * Scores produced in S3 are saved as `baseline_score` in `competency_states`.
  * **Preservation Rule (§44):** The initial `baseline_score` is immutable. Later practice or learning evidence updates current performance but preserves the baseline starting point, enabling longitudinal learning gain calculation: `LEARNING GAIN = FINAL SCORE - BASELINE SCORE`.

---

## 5. Initial Confidence Calculation

Score and confidence are distinct dimensions:
* **Mastery / Baseline Score:** How well the learner performed on the questions.
* **Evidence Confidence:** How strongly the available evidence supports that estimate.
  * 1 item = 0.40 (limited confidence)
  * 2 consistent items = 0.65
  * 2 conflicting items = 0.30 (high uncertainty)
  * 3+ consistent items = 0.85

---

## 6. Map Version Freeze

When a diagnostic session is initiated:
* The active competency map version (e.g., `1.0.0`) is captured on the session and evidence records.
* Even if the domain curriculum later increments to `2.0.0`, historical diagnostic evidence remains anchored to the map version under which it was administered.

---

## 7. Security & User Isolation

* **Strict Authorization (§36):**
  * Service layer enforces user ownership on goals, sessions, responses, and learning states.
  * User A cannot read User B's goal, submit answers to User B's diagnostic, or access User B's state (`UnauthorizedAccessError` / HTTP 403).
* **Database RLS (§37):**
  * Every table has RLS enabled with `USING (auth.uid() = user_id)`.
