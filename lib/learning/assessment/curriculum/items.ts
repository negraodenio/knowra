import { AssessmentItem } from "../types";

export const CURATED_INDEPENDENT_ASSESSMENT_ITEMS: AssessmentItem[] = [
  // ============================================================
  // PYTHON FINAL FORM ITEMS (Strictly independent from diagnostic)
  // ============================================================
  {
    id: "final-py-var-1",
    domainId: "python-junior",
    competencyId: "py-variables-types",
    prompt: "Given `val = bool('False')`, what is the value and type of `val` in Python?",
    itemType: "MULTIPLE_CHOICE",
    difficulty: 2,
    options: ["False of type bool", "True of type bool", "'False' of type str", "TypeError"],
    correctAnswer: "True of type bool",
    explanation: "Any non-empty string in Python evaluates to True when passed to bool(), regardless of the string content.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-py-cond-1",
    domainId: "python-junior",
    competencyId: "py-conditionals",
    prompt: "What is the output of the following ternary expression?\n`result = 'High' if 15 % 4 > 2 else 'Low'`",
    itemType: "SHORT_ANSWER",
    difficulty: 2,
    correctAnswer: "High",
    explanation: "15 % 4 equals 3. Since 3 > 2 is True, 'High' is returned.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-py-loop-1",
    domainId: "python-junior",
    competencyId: "py-loops-iteration",
    prompt: "What is the final value of `total` after executing this loop?\n```python\ntotal = 0\nfor n in [3, 7, 2, 8]:\n    if n > 5:\n        total += n\n```",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "15",
    explanation: "Numbers greater than 5 are 7 and 8. 7 + 8 = 15.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-py-func-1",
    domainId: "python-junior",
    competencyId: "py-functions-scope",
    prompt: "What will `calc(4)` evaluate to given:\n```python\ndef calc(x, multiplier=3):\n    return x * multiplier - 2\n```",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "10",
    explanation: "4 * 3 - 2 = 12 - 2 = 10.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-py-ds-1",
    domainId: "python-junior",
    competencyId: "py-data-structures-lists-tuples",
    prompt: "If `nums = [10, 20, 30, 40, 50]`, what does `nums[1:4]` return?",
    itemType: "MULTIPLE_CHOICE",
    difficulty: 2,
    options: ["[20, 30, 40]", "[10, 20, 30]", "[20, 30, 40, 50]", "[10, 20, 30, 40]"],
    correctAnswer: "[20, 30, 40]",
    explanation: "Slicing [1:4] includes indices 1, 2, and 3, which correspond to [20, 30, 40].",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // PYTHON D7 RETENTION ITEMS (Distinct independent form)
  // ============================================================
  {
    id: "ret7-py-var-1",
    domainId: "python-junior",
    competencyId: "py-variables-types",
    prompt: "What is the evaluated output of `type(int('42')) == int`?",
    itemType: "TRUE_FALSE",
    difficulty: 1,
    correctAnswer: "True",
    explanation: "int('42') converts the string to integer 42, whose type is int.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret7-py-cond-1",
    domainId: "python-junior",
    competencyId: "py-conditionals",
    prompt: "What does `not (True and False)` evaluate to in Python?",
    itemType: "TRUE_FALSE",
    difficulty: 1,
    correctAnswer: "True",
    explanation: "True and False evaluates to False. not False evaluates to True.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret7-py-loop-1",
    domainId: "python-junior",
    competencyId: "py-loops-iteration",
    prompt: "How many times does this while loop execute?\n```python\nk = 10\nwhile k > 4:\n    k -= 2\n```",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "3",
    explanation: "k values: start 10 -> after 1st iter: 8, after 2nd: 6, after 3rd: 4 (loop exits). Exactly 3 executions.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret7-py-func-1",
    domainId: "python-junior",
    competencyId: "py-functions-scope",
    prompt: "Can a Python function return multiple comma-separated values as a tuple?",
    itemType: "TRUE_FALSE",
    difficulty: 1,
    correctAnswer: "True",
    explanation: "Statements like `return a, b` automatically pack values into a tuple.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // PYTHON D30 RETENTION ITEMS (Distinct independent form)
  // ============================================================
  {
    id: "ret30-py-var-1",
    domainId: "python-junior",
    competencyId: "py-variables-types",
    prompt: "What will `len(str(100 + 200))` return?",
    itemType: "NUMERIC",
    difficulty: 1,
    correctAnswer: "3",
    explanation: "100 + 200 = 300. str(300) = '300', which has length 3.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret30-py-cond-1",
    domainId: "python-junior",
    competencyId: "py-conditionals",
    prompt: "If `x = 5`, what will `1 < x < 10` evaluate to in Python?",
    itemType: "TRUE_FALSE",
    difficulty: 1,
    correctAnswer: "True",
    explanation: "Python supports chained comparison operators; 1 < 5 and 5 < 10 is True.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret30-py-loop-1",
    domainId: "python-junior",
    competencyId: "py-loops-iteration",
    prompt: "What is the output of `sum(range(1, 5))` in Python?",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "10",
    explanation: "range(1, 5) yields 1, 2, 3, 4. 1 + 2 + 3 + 4 = 10.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret30-py-func-1",
    domainId: "python-junior",
    competencyId: "py-functions-scope",
    prompt: "Variables defined inside a function body without `global` have local scope.",
    itemType: "TRUE_FALSE",
    difficulty: 1,
    correctAnswer: "True",
    explanation: "By default in Python, assignments inside functions create local variables.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // MATHEMATICS FINAL FORM ITEMS
  // ============================================================
  {
    id: "final-math-alg-1",
    domainId: "math-exams",
    competencyId: "math-algebraic-expressions",
    prompt: "Simplify the expression: `3(2x - 4) + 5x`. What is the coefficient of x?",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "11",
    explanation: "3(2x) - 12 + 5x = 6x - 12 + 5x = 11x - 12. The coefficient of x is 11.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-math-lin-1",
    domainId: "math-exams",
    competencyId: "math-linear-equations",
    prompt: "Solve for y: `4y - 7 = 17`. What is the value of y?",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "6",
    explanation: "4y = 24 => y = 6.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-math-sys-1",
    domainId: "math-exams",
    competencyId: "math-linear-systems",
    prompt: "If `x + y = 10` and `x - y = 4`, what is the value of x?",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "7",
    explanation: "Adding both equations: 2x = 14 => x = 7.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-math-quad-1",
    domainId: "math-exams",
    competencyId: "math-quadratic-equations",
    prompt: "What is the positive root of the equation `x^2 - 9 = 0`?",
    itemType: "NUMERIC",
    difficulty: 1,
    correctAnswer: "3",
    explanation: "x^2 = 9 => x = 3 or x = -3. Positive root is 3.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // MATHEMATICS RETENTION D7 ITEMS
  // ============================================================
  {
    id: "ret7-math-alg-1",
    domainId: "math-exams",
    competencyId: "math-algebraic-expressions",
    prompt: "Evaluate `2a + 3b` when `a = 4` and `b = 5`.",
    itemType: "NUMERIC",
    difficulty: 1,
    correctAnswer: "23",
    explanation: "2(4) + 3(5) = 8 + 15 = 23.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret7-math-lin-1",
    domainId: "math-exams",
    competencyId: "math-linear-equations",
    prompt: "Solve for z: `5z = 35`.",
    itemType: "NUMERIC",
    difficulty: 1,
    correctAnswer: "7",
    explanation: "z = 35 / 5 = 7.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // MATHEMATICS RETENTION D30 ITEMS
  // ============================================================
  {
    id: "ret30-math-alg-1",
    domainId: "math-exams",
    competencyId: "math-algebraic-expressions",
    prompt: "What is `(x + 2)(x - 2)` in expanded form? (Answer format: x^2 - 4)",
    itemType: "SHORT_ANSWER",
    difficulty: 1,
    correctAnswer: "x^2 - 4",
    explanation: "Difference of squares: a^2 - b^2 = x^2 - 4.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret30-math-lin-1",
    domainId: "math-exams",
    competencyId: "math-linear-equations",
    prompt: "If `2x + 10 = 20`, what is x?",
    itemType: "NUMERIC",
    difficulty: 1,
    correctAnswer: "5",
    explanation: "2x = 10 => x = 5.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // EXCEL FINAL FORM ITEMS
  // ============================================================
  {
    id: "final-xl-nav-1",
    domainId: "excel-pro",
    competencyId: "xl-navigation-basics",
    prompt: "In Excel, which reference style locks both the column and row when copying a formula?",
    itemType: "MULTIPLE_CHOICE",
    difficulty: 1,
    options: ["$A$1", "A$1", "$A1", "A1"],
    correctAnswer: "$A$1",
    explanation: "$ before column and row indicates an absolute reference.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-xl-math-1",
    domainId: "excel-pro",
    competencyId: "xl-core-math-functions",
    prompt: "If cells A1:A3 contain values 10, 20, and 30, what does `=AVERAGE(A1:A3)` return?",
    itemType: "NUMERIC",
    difficulty: 1,
    correctAnswer: "20",
    explanation: "(10 + 20 + 30) / 3 = 60 / 3 = 20.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-xl-logic-1",
    domainId: "excel-pro",
    competencyId: "xl-logical-formulas",
    prompt: "What is returned by `=IF(10 > 5, 'Pass', 'Fail')`?",
    itemType: "SHORT_ANSWER",
    difficulty: 1,
    correctAnswer: "Pass",
    explanation: "The condition 10 > 5 is True, so the true value 'Pass' is returned.",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "final-xl-cond-1",
    domainId: "excel-pro",
    competencyId: "xl-conditional-math",
    prompt: "If cells A1:A4 are [5, 10, 15, 20], what does `=COUNTIF(A1:A4, '>10')` return?",
    itemType: "NUMERIC",
    difficulty: 2,
    correctAnswer: "2",
    explanation: "Values strictly greater than 10 are 15 and 20 (2 cells).",
    formType: "FINAL",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // EXCEL RETENTION D7 ITEMS
  // ============================================================
  {
    id: "ret7-xl-nav-1",
    domainId: "excel-pro",
    competencyId: "xl-navigation-basics",
    prompt: "Pressing Ctrl+Z in Excel undoes the last action.",
    itemType: "TRUE_FALSE",
    difficulty: 1,
    correctAnswer: "True",
    explanation: "Ctrl+Z is the standard shortcut to undo an operation.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret7-xl-math-1",
    domainId: "excel-pro",
    competencyId: "xl-core-math-functions",
    prompt: "What does `=SUM(5, 15, 25)` return in Excel?",
    itemType: "NUMERIC",
    difficulty: 1,
    correctAnswer: "45",
    explanation: "5 + 15 + 25 = 45.",
    formType: "RETENTION_D7",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },

  // ============================================================
  // EXCEL RETENTION D30 ITEMS
  // ============================================================
  {
    id: "ret30-xl-math-1",
    domainId: "excel-pro",
    competencyId: "xl-core-math-functions",
    prompt: "Which function calculates the largest numeric value in a range in Excel?",
    itemType: "SHORT_ANSWER",
    difficulty: 1,
    correctAnswer: "MAX",
    explanation: "MAX returns the largest number in a set of values.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
  {
    id: "ret30-xl-logic-1",
    domainId: "excel-pro",
    competencyId: "xl-logical-formulas",
    prompt: "In Excel, `=AND(TRUE, FALSE)` returns FALSE.",
    itemType: "TRUE_FALSE",
    difficulty: 1,
    correctAnswer: "True",
    explanation: "AND requires all arguments to be TRUE to return TRUE.",
    formType: "RETENTION_D30",
    version: "v1",
    itemVersion: 1,
    provenance: "CURATED",
    status: "ACTIVE",
  },
];

export function getIndependentAssessmentItems(
  domainId: string,
  formType: AssessmentItem["formType"]
): AssessmentItem[] {
  return CURATED_INDEPENDENT_ASSESSMENT_ITEMS.filter(
    (item) => item.domainId === domainId && item.formType === formType && item.status === "ACTIVE"
  );
}

export function getAssessmentItemById(itemId: string): AssessmentItem | undefined {
  return CURATED_INDEPENDENT_ASSESSMENT_ITEMS.find((item) => item.id === itemId);
}

/**
 * Validates that candidate assessment items do NOT leak baseline items:
 * - Checks distinct item IDs
 * - Checks no identical prompt strings
 */
export function validateItemIndependence(
  baselineItemIds: string[],
  candidateItems: AssessmentItem[],
  baselinePrompts?: string[]
): { isIndependent: boolean; violations: string[] } {
  const violations: string[] = [];

  const baselineIdSet = new Set(baselineItemIds);
  for (const item of candidateItems) {
    if (baselineIdSet.has(item.id)) {
      violations.push(`Item ID collision with baseline: ${item.id}`);
    }
  }

  if (baselinePrompts && baselinePrompts.length > 0) {
    const normalizedBaselinePrompts = new Set(
      baselinePrompts.map((p) => p.trim().toLowerCase())
    );
    for (const item of candidateItems) {
      if (normalizedBaselinePrompts.has(item.prompt.trim().toLowerCase())) {
        violations.push(`Prompt text duplication detected for item: ${item.id}`);
      }
    }
  }

  return {
    isIndependent: violations.length === 0,
    violations,
  };
}
