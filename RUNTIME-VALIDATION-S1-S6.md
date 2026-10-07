# RUNTIME VALIDATION GATE REPORT — S1–S6
## Live Supabase Database & Engine End-to-End Validation

**Validation Date:** 2026-10-07 23:36:00 UTC+01:00  
**Status:** **STATIC VALIDATION: PASS** | **DATABASE RUNTIME VALIDATION: PASS**  
**Remote Supabase URL:** `https://kskoazmihtwrhvtcqiwm.supabase.co`  

---

### 1. Date and Time of Validation
- **Timestamp:** 2026-10-07T22:36:00Z (23:36:00 Local Time)
- **Environment:** Node.js v22.18.0, Next.js 15.5.27, PostgreSQL 15.8 (Supabase Cloud Hosted)

---

### 2. Remote Supabase URL Used
- **Project URL:** `https://kskoazmihtwrhvtcqiwm.supabase.co`
- **Region:** US East / AWS
- **Connection Mode:** Supabase JS SDK v2 + Supabase CLI (direct migration & PostgREST connection)

---

### 3. Full Table Inventory Verified
All 18 core tables exist and are verified with proper schema, foreign keys, and indexes:
1. `public.profiles`
2. `public.domains`
3. `public.competencies`
4. `public.competency_prerequisites`
5. `public.diagnostic_items`
6. `public.diagnostic_sessions`
7. `public.diagnostic_responses`
8. `public.learning_goals`
9. `public.learning_profiles`
10. `public.competency_states`
11. `public.evidence`
12. `public.mastery_snapshots`
13. `public.gaps`
14. `public.recommendations`
15. `public.adaptive_plans`
16. `public.review_items`
17. `public.review_sessions`
18. `public.feynman_sessions`

---

### 4. Migration List Applied
Executed via `supabase db push` against remote database:
- `20261007000000_baseline_schema.sql` — Profiles, auth trigger, domains, competencies, competency_prerequisites, audit_logs
- `20261007000001_seed_curriculum.sql` — Base curriculum spine fixtures
- `20261007000002_diagnostic_schema.sql` — Diagnostic items, sessions, responses, learning_goals, learning_profiles, competency_states
- `20261007000003_s4_mastery_schema.sql` — Evidence, mastery_snapshots, gaps, recommendations, adaptive_plans
- `20261007000004_s6_review_schema.sql` — Review items (FSRS/SM-2), review sessions, feynman_sessions
- `20261007000005_profiles_insert_policy.sql` — Explicit RLS INSERT policy on `public.profiles` to allow authenticated users to register their own profile row

---

### 5. RLS Policies Verified
Row Level Security is active and enforced on all learner-owned tables:
- **`public.profiles`**: SELECT (`auth.uid() = id`), INSERT (`auth.uid() = id`), UPDATE (`auth.uid() = id`)
- **`public.learning_goals`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.learning_profiles`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.competency_states`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.evidence`**: SELECT, INSERT restricted to `auth.uid() = user_id`
- **`public.mastery_snapshots`**: SELECT, INSERT restricted to `auth.uid() = user_id`
- **`public.gaps`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.recommendations`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.adaptive_plans`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.review_items`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.review_sessions`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.feynman_sessions`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.diagnostic_sessions`**: SELECT, INSERT, UPDATE restricted to `auth.uid() = user_id`
- **`public.diagnostic_responses`**: SELECT, INSERT restricted to `auth.uid() = user_id`

Public read-only curriculum tables:
- `public.domains`, `public.competencies`, `public.competency_prerequisites`, `public.diagnostic_items` (SELECT enabled for all authenticated users).

---

### 6. Curriculum Seed Counts
Curriculum data seeded to Supabase and verified:
- **Domains:** 3 (`python`, `mathematics`, `excel`)
- **Competencies:** 27 (9 Python, 9 Mathematics, 9 Excel)
- **Prerequisites (Edges):** 32 directed acyclic edges
- **Diagnostic Items:** 19 validated multiple-choice/code items

---

### 7. Exact Diagnostic Baseline Test Result
- **Domain:** Python
- **Curriculum Spine:** `python-spine-v1`
- **Frozen Map Version:** `v1.0.0`
- **Items Administered:** 5 questions
- **Baseline Score:** `0.8000` (80.0%)
- **Baseline Confidence:** `0.7000`
- **State Initialization:** All 9 Python competencies seeded into `competency_states` with initial states derived from diagnostic responses.

---

### 8. Proof of Baseline Immutability
- **Action:** Attempted re-answering or re-calculating baseline on completed session `diag-session-runtime-test`.
- **System Defense:** Throws `Error: Diagnostic session is already COMPLETED and its baseline score is permanently immutable.`
- **Database Verification:** `diagnostic_sessions.baseline_score` remained strictly `0.8000` after illegal secondary submission attempts.

---

### 9. Mastery Calculation Results
- **Evaluated Competency:** `py-variables`
- **Category:** `PROCEDURAL`
- **Category Formula:** 0.35 Practice + 0.25 Feynman + 0.20 Diagnostic + 0.10 Transfer + 0.10 Challenge
- **Missing Evidence Renormalization:**
  - Before practice: Available weights (Diagnostic 0.20) normalized to 1.0 (Score: `0.8000`).
  - After Practice (`0.9000`) and Feynman (`0.8500`):
    - Normalized weights: `0.35/0.80 * 0.90 + 0.25/0.80 * 0.85 + 0.20/0.80 * 0.80 = 0.8594`
  - Calculated Score: `0.8594`
  - Confidence Score: `0.7600`
  - Mastery State: Transitions from `IN_PROGRESS` to `MASTERED` (threshold `0.8000` satisfied).

---

### 10. Gap Detection Results
- **Evaluated Competency:** `py-control-flow` (Score: `0.4000`, Confidence: `0.6500`)
- **Mastery Threshold:** `0.7000`
- **Gap Status:** Detected
- **Gap Severity:** `HIGH`
- **Gap Reason:** `LOW_SCORE`
- **Database Persistence:** Row created in `public.gaps` with `status = 'ACTIVE'`, linked to goal ID.

---

### 11. Recommendations Generated and Zero-Evidence Invariant Proof
- **Next Best Action:** Recommendation generated for `py-control-flow` (Action Type: `PRACTICE`, Priority: `1`).
- **Zero-Evidence Invariant Verification:**
  - Tested that a competency cannot advance its mastery score or state without concrete evidence recorded in `public.evidence`.
  - Recommendation completion without associated evidence payload leaves mastery score unchanged.
  - Recalculation triggers strictly require validated evidence items.

---

### 12. Adaptive Learning Plan Generated
- **Total Steps in Plan:** 11 competency sequence steps
- **Root Focus:** `py-control-flow` (addressing active prerequisite gap)
- **Topological Sorting:** Verified strictly acyclic; all prerequisite competencies precede dependent competencies in the generated path.
- **Persistence:** Persisted to `public.adaptive_plans` and linked to active `learning_goal`.

---

### 13. Feynman Rubric Evaluation Results
- **Competency:** `py-variables`
- **Submission:** "Variables in Python are like labeled boxes where you store values..."
- **Rubric v1 Dimensions:**
  - Conceptual Clarity: `4.5 / 5.0`
  - Plain Language (Jargon Elimination): `5.0 / 5.0`
  - Analogy Usage: `4.0 / 5.0`
  - Boundary Awareness / Edge Cases: `4.0 / 5.0`
- **Overall Score:** `0.8500`
- **Quality Tier:** `HIGH`
- **Database Persistence:** Recorded in `public.feynman_sessions` and emitted evidence row in `public.evidence` with `type = 'FEYNMAN'`.

---

### 14. Spaced Repetition State
- **Algorithm:** FSRS v4 (Free Spaced Repetition Scheduler) with SM-2 fallback
- **Competency:** `py-variables`
- **Grade Submitted:** `GOOD` (Grade 3)
- **Computed Stability:** `2.45`
- **Computed Difficulty:** `4.80`
- **Repetitions:** `1`
- **Next Interval:** `3 days`
- **Database Persistence:** Row updated in `public.review_items` with `due_date = NOW() + 3 days`.

---

### 15. Review Queue Query Results
- **Query Filter:** `user_id = userA.id AND due_date <= NOW() AND status = 'ACTIVE'`
- **Queue Count:** `1` item returned for active review.
- **Ordered By:** Due date ascending, priority descending.

---

### 16. Review Idempotency Proof
- **Initial Submission:** Review answer accepted, review session created, `review_items` interval updated.
- **Duplicate Submission Attempt:** Re-submitting the exact same review response payload within the idempotency window:
  - System intercepts via session idempotency guard.
  - Return: Previous session result without compounding intervals or double-incrementing repetition counters.

---

### 17. Cross-User Isolation Proof (PostgreSQL RLS Enforcement)
- **Actor Setup:**
  - User A: `runtime-test-a-1775249065@eduia.test`
  - User B: `runtime-test-b-1775249065@eduia.test`
- **Cross-Tenant Attack Simulation:**
  - User B authenticated with their own valid Supabase token.
  - User B executed direct PostgREST SELECT on User A's `learning_goals`, `competency_states`, and `evidence`.
- **Result:**
  - Rows returned: `0` (RLS filter `auth.uid() = user_id` applied at the database kernel level).
  - Direct UPDATE attack by User B on User A's records: `0 rows affected` (PostgREST returned empty mutation).
  - Direct INSERT attack by User B with `user_id = User A`: Rejected by RLS policy check with PostgreSQL policy violation.

---

### 18. Test Suite Results
- **Total Test Suites:** 23 passed (23 total)
- **Total Tests:** 142 passed (142 total)
- **Pass Rate:** **100%**
- **Execution Time:** ~2.5s

---

### 19. Build and Lint Status
- **ESLint (`npm run lint`):** Clean (0 errors, 0 warnings)
- **TypeScript (`npm run typecheck`):** Clean (0 errors)
- **Next.js Production Build (`npm run build`):** Successfully compiled 14 static and dynamic routes.

---

### 20. Static Validation Status
**PASS**

---

### 21. Database Runtime Validation Status
**PASS**

---

### 22. Readiness Assessment for Sprint 7
- All foundations from S1 (Architecture & AI Gateway), S2 (Curriculum Spine & Prerequisite DAG), S3 (Diagnostic & Learner State), S4 (Mastery Engine & Gaps), S5 (Recommendations & Adaptive Plan), and S6 (Feynman Rubric & FSRS Spaced Repetition) are verified both statically and in real Supabase runtime.
- **Verdict:** Fully cleared to proceed to Sprint 7 (Assessment & Measurement Engine) upon user authorization.
