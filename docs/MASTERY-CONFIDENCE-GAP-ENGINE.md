# MASTERY ENGINE, EVIDENCE CONFIDENCE, AND GAP DETECTION SPECIFICATION (SPRINT 4)

**Version:** 1.0 (Algorithm Version: `v1`)  
**Status:** Approved & Verified  
**Product Reference:** Master Specification v3.1 (§2, §3, §4, §5, §7, §8, §11, §12, §16, §18, §19, §22, §25, §29, §62)

---

## 1. Core Conceptual Distinctions (§2, §3)

The platform maintains strict architectural boundaries between five fundamental concepts:
1. **BASELINE (`baseline_score`):** Immutable starting point established during initial diagnostic assessment. Never overwritten.
2. **MASTERY (`mastery_score`):** Current estimated competency knowledge (0–100) calculated deterministically from observable evidence.
3. **CONFIDENCE (`confidence_score`):** Strength of observable evidence supporting the current mastery estimate (0.0–1.0).
4. **EVIDENCE (`evidence`):** Immutable historical observations (Diagnostic, Exercise, Feynman, Review, Application).
5. **GAP (`gap`):** Derived state indicating insufficient mastery supported by at least two independent failure signals.

---

## 2. Category-Specific Mastery Formulas (§7, §37)

Mastery calculation depends directly on the competency's learning category:

### A. Conceptual Competencies (e.g. Python Functions, Quadratic Equations)
$$\text{Mastery} = 0.40 \cdot \text{Exercise} + 0.25 \cdot \text{Feynman} + 0.20 \cdot \text{Review} + 0.15 \cdot \text{Diagnostic}$$

### B. Procedural Competencies (e.g. Excel XLOOKUP, Pivot Tables, Python Testing)
$$\text{Mastery} = 0.55 \cdot \text{Application} + 0.20 \cdot \text{Exercise} + 0.15 \cdot \text{Review} + 0.10 \cdot \text{Diagnostic}$$

### C. Factual Competencies (e.g. Trigonometric Ratios, Keyboard Shortcuts)
$$\text{Mastery} = 0.60 \cdot \text{Exercise} + 0.30 \cdot \text{Review} + 0.10 \cdot \text{Diagnostic}$$

---

## 3. Missing Evidence Renormalization (§8)

In real learner journeys, not every evidence component is present immediately. Missing evidence is **never** treated as zero (which would falsely penalize learners) or given artificial full credit.

**Rule:** Available weights are renormalized:
$$\text{Weight}_{\text{norm}} = \frac{\text{ConfiguredWeight}}{\sum \text{AvailableWeights}}$$

### Worked Example: Conceptual with Missing Feynman & Review (§64)
* Diagnostic = 60 (configured weight 0.15)
* Exercise = 80 (configured weight 0.40)
* Feynman = Missing, Review = Missing
* Available weight sum = $0.15 + 0.40 = 0.55$
* Normalized Exercise weight = $0.40 / 0.55 \approx 0.7273$
* Normalized Diagnostic weight = $0.15 / 0.55 \approx 0.2727$
$$\text{Mastery} = 80 \cdot 0.7273 + 60 \cdot 0.2727 = 58.18 + 16.36 = 74.55 \quad (\text{DEVELOPING})$$

---

## 4. Recency Weighting Strategy (§11, §41)

Recent performance carries greater weight than distant historical observations:
$$\text{Weight}_{\text{recency}} = \exp(-\lambda \cdot \text{ageInDays}) \quad \text{where} \quad \lambda = \frac{\ln(2)}{\text{halfLifeDays}}$$
* Default half-life: 45 days.
* Evidence at 45 days old receives 50% weight; evidence at 90 days receives 25% weight.
* **Immutability Invariant:** Historical evidence records are never altered. Recency decay is applied purely at calculation runtime.

---

## 5. Evidence Confidence Model (§12, §13, §14, §15, §40)

Confidence evaluates four independent dimensions:
1. **Volume Factor:** Scaled from single observation (base 0.50) up to 4+ observations (0.85+).
2. **Diversity Factor:** Distinct evidence types multiplier (1 type = 0.85, 2 types = 1.00, 3+ types = 1.15).
3. **Consistency Factor:** Penalty proportional to variance across observations (conflicting scores penalize confidence down to 0.50).
4. **Aging Factor:** Mean recency of evidence.
5. **Hard Ceilings (§15):**
   * 1 observation $\leq 0.40$
   * 2 observations $\leq 0.65$
   * 3+ observations $\leq 0.95$

---

## 6. Gap Detection & Multi-Signal Requirement (§18, §22, §28)

To protect against false positives caused by isolated mistakes, gap declaration requires **at least TWO independent negative signals**:
1. `DIAGNOSTIC_WEAKNESS`: Diagnostic baseline $< 60\%$
2. `EXERCISE_FAILURE`: Recent exercise score $< 60\%$
3. `REVIEW_FAILURE`: Recent review retrieval score $< 60\%$
4. `APPLICATION_FAILURE`: Practical task score $< 60\%$
5. `PERSISTENT_LOW_MASTERY`: Current estimated mastery $< 60\%$ across multiple observations
6. `CRITICAL_PREREQUISITE_DEFICIT`: Competency blocks downstream DAG nodes with mastery $< 65\%$

### Severity Classification (§25)
* `CRITICAL`: Mastery $< 40\%$ AND is a prerequisite for downstream competencies, OR $\geq 3$ negative signals.
* `HIGH`: Mastery $< 50\%$ OR unblocks $\geq 2$ downstream competencies with mastery $< 60\%$.
* `MEDIUM`: Mastery between $50\%$ and $60\%$ with 2 failure signals.
* `LOW`: Marginal deficit with prerequisite friction.

### Lifecycle: Resolution & Reopening (§29, §30)
* **Resolution:** When new evidence raises mastery to $\geq 70\%$, the gap transitions to `RESOLVED` with a `resolvedAt` timestamp.
* **Reopening:** If performance subsequently drops below $60\%$ with failure signals, the existing gap record reopens (`status: 'OPEN'`), preserving historical audit continuity.

---

## 7. Longitudinal Snapshot Auditing (§19, §55)

Each recalculation event appends an immutable record to `mastery_snapshots`:
* Preserves `mastery_score`, `confidence`, `mastery_state`, `calculation_version` (`v1`), and `evidence_summary`.
* Historical snapshots are never mutated, enabling longitudinal progress tracking across beta cohorts.
