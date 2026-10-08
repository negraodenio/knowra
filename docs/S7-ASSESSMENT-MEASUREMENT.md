# S7 — Assessment & Measurement Engine Specification & Architecture

## 1. Executive Summary & Purpose
The objective of Sprint 7 (S7) is to provide empirical, scientific verification that the Adaptive Learning Platform produces actual learning, separating usage, retention-as-login, and engagement metrics from authentic cognitive gains.

The core measurement loop is:
```
BASELINE (IMMUTABLE)
   ↓
ADAPTIVE INTERVENTION (S4 Mastery + S5 NBA + S6 Review & Feynman)
   ↓
INDEPENDENT FINAL ASSESSMENT (DIFFERENT FORM, ZERO ITEM LEAKAGE)
   ↓
LEARNING GAIN (Final Score - Baseline Score)
   ↓
D7 RETENTION ASSESSMENT (Delayed Independent Measurement ~7 Days)
   ↓
D30 RETENTION ASSESSMENT (Delayed Independent Measurement ~30 Days)
```

The primary product metric is **Absolute Learning Gain**:
$$\text{Learning Gain} = \text{Final Assessment Score} - \text{Baseline Score}$$

---

## 2. Assessment Lifecycle & State Machine
Every assessment session follows a strict, finite state machine:
```
CREATED → IN_PROGRESS → SUBMITTED → SCORED → COMPLETED (or EXPIRED)
```

1. **`CREATED`**: Session initialized with blueprint reference, domain, user ownership, and target competency pool.
2. **`IN_PROGRESS`**: Learner receives questions with correct answers and explanations sanitized.
3. **`SUBMITTED`**: All candidate responses received; session locked against further modifications.
4. **`SCORED`**: Deterministic scoring engine evaluates each response on a 0–100 scale.
5. **`COMPLETED`**: Overall and per-competency scores committed, learning gain or retention metrics computed and persisted, and append-only evidence emitted to learner state.
6. **`EXPIRED`**: Stale sessions exceeding time limits are marked expired without contaminating measurement baselines.

---

## 3. Baseline vs. Final Independence & Anti-Leakage Safeguards
To prevent "teaching to the test" or trivial question memorization:
1. **Disjoint Item IDs**: Final and retention assessments never reuse baseline diagnostic item IDs.
2. **Context & Wording Independence**: Items measure identical competencies (e.g. `py-conditionals`, `math-linear-equations`) using distinct prompts, examples, data points, and code constructs.
3. **Multi-Form Separation**:
   - `BASELINE` (Diagnostic initial form)
   - `FINAL` (Independent mastery verification form)
   - `RETENTION_D7` (Distinct short-term retention form)
   - `RETENTION_D30` (Distinct long-term retention form)
4. **Deterministic Anti-Leakage Validator**: `validateItemIndependence(finalItems, baselineItems)` enforces zero ID overlap, non-identical prompts, and difficulty distribution parity.

---

## 4. Deterministic Scoring Engine
All assessment items are evaluated deterministically on a normalized **0–100** scale:
- **`MULTIPLE_CHOICE`**: Case-insensitive exact option matching (100% or 0%).
- **`TRUE_FALSE`**: Normalized boolean matching ("True"/"False", "true"/"false") (100% or 0%).
- **`NUMERIC`**: Numerical value equivalence within floating point tolerance $\epsilon = 0.001$.
- **`SHORT_ANSWER`**: Canonical string normalization (trimmed, lowercased, punctuation stripped) or structured rubric evaluation.

Scores are aggregated by:
$$\text{Overall Score} = \left(\frac{\sum_{i=1}^{N} \text{item\_score}_i}{N}\right)$$
Per-competency scores are calculated as the mean score of all items tagged with that competency ID.

---

## 5. Learning Gain Metrics
The platform calculates two gains, with absolute gain serving as the primary product KPI:
1. **Absolute Learning Gain (Primary)**:
   $$\text{Gain}_{\text{abs}} = \text{Score}_{\text{final}} - \text{Score}_{\text{baseline}}$$
2. **Normalized Relative Gain**:
   $$\text{Gain}_{\text{rel}} = \frac{\text{Score}_{\text{final}} - \text{Score}_{\text{baseline}}}{100 - \text{Score}_{\text{baseline}}}$$
   *(Clamped to $[-1.0, 1.0]$ with divide-by-zero protection when baseline score is 100).*

---

## 6. Competency-Level Gain Analysis
Beyond aggregate scores, learning gain is broken down at the individual competency level:
$$\Delta C_k = C_{k,\text{final}} - C_{k,\text{baseline}}$$
- **`LEARNED`**: $\Delta C_k \ge +10.0$ points or $C_{k,\text{final}} \ge 80.0$ with $\Delta C_k > 0$.
- **`UNCHANGED`**: $-10.0 < \Delta C_k < +10.0$.
- **`REGRESSED`**: $\Delta C_k \le -10.0$ points.

---

## 7. Knowledge & Skill Retention (D7 & D30)
Retention measures whether acquired knowledge survives decay curves:
- **`D7 Retention Ratio`**:
  $$\text{Retention}_{\text{D7}} = \frac{\text{Score}_{\text{D7}}}{\max(\text{Score}_{\text{final}}, 1.0)}$$
- **`D30 Retention Ratio`**:
  $$\text{Retention}_{\text{D30}} = \frac{\text{Score}_{\text{D30}}}{\max(\text{Score}_{\text{final}}, 1.0)}$$
- **Gain Retained**:
  $$\text{Gain Retained} = \text{Score}_{\text{Retention}} - \text{Score}_{\text{baseline}}$$

---

## 8. Integration with S1–S6 Learning Engine
1. **Preservation of Diagnostic Baseline**: The diagnostic baseline established in S3 is permanently immutable. No final assessment, retention test, or exercise modifies historical baseline scores.
2. **Evidence Model Compatibility**: S7 introduces typed evidence records (`FINAL_ASSESSMENT`, `RETENTION_D7`, `RETENTION_D30`) that append to the learner's evidence stream.
3. **Mastery Engine Integration**: Category-specific weights (conceptual, procedural, factual) incorporate assessment evidence without bypassing the deterministic `updateCompetencyMastery` service.

---

## 9. Security & Row Level Security (RLS)
1. **Strict User Scoping**: Assessment sessions, responses, gains, and retention records require `auth.uid() = user_id`.
2. **Client Obfuscation**: Correct answers and pedagogical explanations are stripped before sessions are returned to the client.
3. **Cross-User Isolation**: User B cannot query, submit answers to, or inspect User A's sessions or learning gains.

---

## 10. AI Gateway Usage & Structured Output Validation
When generating assessment questions:
- Uses existing `lib/ai/gateway.ts` with task `"assessment"`.
- Validated via strict Zod schema (`AssessmentItemSchema`).
- Telemetry tracked: provider, model, input/output tokens, latency, cost.
- Malformed AI outputs are rejected and fall back to curated item pools.
- LLMs never write scores or mutate state directly.

---

## 11. Database Architecture (S7 Tables)
Added in migrations `20261007000006_s7_assessment_and_measurement.sql` and `20261007000007_s7_evidence_type_expansion.sql`:
1. `public.assessment_blueprints`: Defines target competencies, distribution, item counts.
2. `public.independent_assessment_items`: Versioned, independent item pool.
3. `public.independent_assessment_sessions`: Session lifecycle and scores.
4. `public.independent_assessment_responses`: Individual item submissions.
5. `public.learning_gains`: Baseline vs Final comparisons and competency gains.
6. `public.retention_records`: D7 and D30 retention ratios and scores.

---

## 12. Versioning & Immutability
- Blueprints: versioned string (`v1`, `v2`).
- Items: `assessmentVersion` (`v1`) and integer `itemVersion` (1).
- Sessions: frozen to blueprint and item versions at creation time.
- Scores and gains: immutable snapshots once calculated.

---

## 13. Known Limitations
1. Retention intervals (7 and 30 days) are evaluated based on timestamp delta or test-trigger scheduling; full background push notifications will be coupled to notification infrastructure.
2. Curated independent items currently support the 3 MVP domains (Python, Mathematics, Excel). AI generation provides on-demand extensibility for future domains.
