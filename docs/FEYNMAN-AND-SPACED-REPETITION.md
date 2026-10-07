# Sprint 6 — Feynman Technique, Spaced Repetition, and Review Engine Architecture

## Architectural Thesis

> **"LLMs know things. The Learning Engine knows what the learner knows, how confident it is, what is missing, and what the learner should do next."**

In this architecture:
- **Feynman is an evidence mechanism**, not an unconstrained chatbot.
- **Spaced repetition is a scheduling mechanism**, not a proxy for mastery or gap detection.
- **Mastery is the Learning Engine's deterministic interpretation of multi-signal evidence**.
- **Recommendation is the decision layer** governing Next Best Action (`LEARN`, `PRACTICE`, `FEYNMAN`, `REVIEW`, `REMEDIATE`, `RETRY`, `ADVANCE`).

---

## 1. Feynman Explanation Architecture

The Feynman protocol prompts the learner to explain a concept in simple, layman's terms to verify deep conceptual grasp, causal mechanics, and mental models without rote memorization.

### Lifecycle
```
PENDING ───> STARTED ───> SUBMITTED ───> EVALUATED
```

1. **Deterministic Prompts**: Prompts are derived directly from the competency definition and learning outcomes (e.g., *"Explain what Variables and Primitive Data Types means in your own words, as if explaining to someone who has never programmed before..."*). Prompts do not rely on LLM generation at creation time.
2. **Structured AI Evaluation**: When the learner submits an explanation, the AI Gateway (`lib/ai/gateway.ts`) invokes structured evaluation (`FEYNMAN_EVALUATION`).
3. **Zod Validation**: Raw LLM output is strictly validated against `FeynmanEvaluationSchema`.
4. **Deterministic Rubric Calculation**: After schema acceptance, the final numerical score is calculated deterministically by pure software logic (`calculateFeynmanScore`). The LLM cannot unilaterally set mastery or mutate the learning state.
5. **Append-Only Evidence Creation**: An append-only evidence record with `evidenceType = "FEYNMAN"` is added to the learning state. Mastery and confidence are then recalculated by the S4 deterministic engine.

---

## 2. Feynman Evaluation Rubric

Version: `FEYNMAN_RUBRIC_VERSION = "v1"`

| Component | Weight | Description |
| :--- | :--- | :--- |
| **Correctness** | 30% | Scientific and factual precision of explained mechanics. |
| **Completeness** | 25% | Coverage of prerequisite and core principles. |
| **Causal Reasoning** | 20% | Clear explanations of *why* and *how* rather than merely *what*. |
| **Simplicity** | 10% | Use of relatable analogies and plain language. |
| **Misconception Penalty** | 15% (deduction) | Deducted proportional to the severity and presence of identified fallacies. |

### Formula
$$\text{Score} = \text{clamp}_{[0, 100]}\left(0.30 \cdot C_{\text{corr}} + 0.25 \cdot C_{\text{comp}} + 0.20 \cdot C_{\text{causal}} + 0.10 \cdot C_{\text{simp}} - 0.15 \cdot P_{\text{misconception}}\right)$$

*Note: This formula represents a versioned empirical hypothesis and remains fully configurable for future iterations.*

---

## 3. Evidence Flow & Confidence Integration

Feynman evidence strictly follows the S4 evidence architecture:
```
Feynman Submission
       │
       ▼
Deterministic Rubric Engine
       │
       ▼
Append-Only Evidence (FEYNMAN, score, confidence: 0.80)
       │
       ▼
LearningStateService / MasteryService
       │
       ▼
Category-Specific Mastery Formulas
```

### Invariants:
1. **Category Weighting**: In conceptual competencies (`CATEGORY = "CONCEPTUAL"`), Feynman contributes 25% to the total mastery score ($0.40 \cdot \text{exercises} + 0.25 \cdot \text{Feynman} + 0.20 \cdot \text{reviews} + 0.15 \cdot \text{diagnostic}$). For procedural skills, application and exercises predominate.
2. **Confidence Model**: A single Feynman explanation does not artificially elevate learner confidence. Confidence remains governed by the S4 four-factor model (Volume, Diversity, Consistency, Aging) subject to the hard ceiling rule.
3. **Multi-Signal Gap Protection**: A single weak Feynman explanation **never** triggers an automatic learning gap. Gaps require persistent failure across multiple independent signals or severe diagnostic failure.

---

## 4. Spaced Repetition Provider Abstraction

Spaced repetition logic is decoupled behind the `SpacedRepetitionScheduler` interface (`lib/learning/spaced-repetition/types.ts`):

```typescript
export interface SpacedRepetitionScheduler {
  schedulerType: SchedulerType;
  schedulerVersion: string;
  initItem(referenceDate?: Date): SchedulerState;
  review(state: SchedulerState, rating: ReviewRating, reviewDate?: Date): SchedulingResult;
  getRetrievability(state: SchedulerState, currentDate?: Date): number;
  isDue(state: SchedulerState, currentDate?: Date): boolean;
}
```

Ratings are standardized across schedulers: `AGAIN` (1), `HARD` (2), `GOOD` (3), `EASY` (4).

### Schedulers:
1. **FSRS (`Free Spaced Repetition Scheduler`) — Preferred**:
   - Tracks Memory Stability ($S$), Difficulty ($D$), Repetitions ($R$), and Lapses.
   - Computes retrievability decay: $R(t, S) = (1 + 0.19 \cdot \frac{t}{S})^{-0.5}$.
   - Calculates target interval based on a 90% request retention probability.
2. **SM-2 (`SuperMemo 2`) — Fallback**:
   - Classic algorithm tracking Easiness Factor ($EF \in [1.3, 2.5]$) and interval progression ($I_1=1, I_2=6, I_n=I_{n-1} \cdot EF$).
   - Fallback provider selectable seamlessly without changing application interfaces.

---

## 5. Review Lifecycle, Queue, & Idempotency

### Review Items (`review_items`)
- Tracks user, learning goal, competency, scheduler type, scheduler state, `due_at`, and `last_reviewed_at`.
- Initialized with zero reviews and scheduled immediately for baseline retrieval check.

### Review Queue (`GET /api/learning/review`)
- Returns items where `due_at <= now()`.
- Sorts strictly by overdue duration (most overdue first), ensuring learner attention is focused where retrievability is lowest.
- Supports configurable limits (default: 10 items).

### Review Sessions (`review_sessions`, `review_session_items`)
- Lifecycle: `STARTED` $\longrightarrow$ `COMPLETED`.
- Bundles review items into structured recall sets with batch progress tracking.

### Idempotency Protection (§30)
- `answerReviewItem` enforces a replay guard: duplicate submissions received within 3 seconds return the cached state and do not advance repetitions, inflate intervals, or record duplicate evidence.

---

## 6. S5 Recommendation & Next Best Action Integration

Review scheduling directly feeds into the S5 Recommendation Engine:

```
Scheduler State (due_at <= now)
           │
           ▼
Recommendation Engine (Evaluate Competency Actions)
           │
           ├─── Open Critical Gap? ───────────► REMEDIATE (Outranks REVIEW)
           ├─── Prerequisites Incomplete? ────► BLOCKED (Do not recommend REVIEW)
           ├─── Competency Due for Review? ───► REVIEW
           └─── Conceptual & Low Confidence? ─► FEYNMAN
```

### Key Prioritization Rules:
1. **REMEDIATE vs REVIEW**: If a competency is due for review but suffers from an open critical gap, `REMEDIATE` takes strict precedence.
2. **FEYNMAN vs REVIEW**: `FEYNMAN` is recommended for conceptual competencies with low evidence confidence to verify reasoning. `REVIEW` is recommended when retrievability has decayed over time.
3. **Procedural Protection**: Procedural competencies favor `PRACTICE` and application; `FEYNMAN` is never over-recommended for procedural skills.
4. **Prerequisites Constraint**: Downstream reviews are never recommended if upstream prerequisite dependencies are unsatisfied.

---

## 7. Security & Cross-User Isolation

Every endpoint and service method requires authenticated user verification:
- All queries enforce `user_id = auth.uid()` or explicit API user token context.
- Cross-user session reads, review answer submissions, and scheduler mutations are blocked at both the API layer (HTTP 403 Forbidden) and the database layer (PostgreSQL Row Level Security policies).

---

## 8. Safe AI Failure Handling

If the LLM Gateway fails during Feynman evaluation (timeout, API failure, schema invalidity, or non-JSON output):
- The error is logged to structured telemetry with status `SCHEMA_ERROR` or `FAILED`.
- The session is marked `FAILED` with a user-friendly error message.
- **NO evidence is written to the database.**
- **NO mutations to mastery, confidence, or gaps occur.**
- The learner can safely retry without corrupting their learning profile.

---

## 9. Versioning

All engine outputs and states are explicitly versioned:
- `FEYNMAN_RUBRIC_VERSION = "v1"`
- `FSRS_SCHEDULER_VERSION = "v1"`
- `SM2_SCHEDULER_VERSION = "v1"`
- `COMPETENCY_MAP_VERSION = "1.0.0"`

---

## 10. Known Limitations

1. **LLM Evaluation Subjectivity**: While guided by structured rubrics and deterministic score mathematics, LLM reasoning can display minor variability across models.
2. **Offline Scheduling**: Review scheduling operates synchronously on request; background push notifications for due items are deferred to future production milestones.
3. **Live Supabase Runtime**: Local execution utilizes SQLite/mock databases for unit and integration testing. Live Supabase database runtime execution remains to be performed against a live cluster.
