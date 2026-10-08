/**
 * Domain Detection for Natural Language Learning Goals (§6, §7)
 * Translates arbitrary learner intentions to curated MVP domains (Python, Mathematics, Excel)
 * or returns null for honest UX fallback without pretending unsupported domains exist.
 */
export function detectDomainFromObjective(objective: string): { id: string; name: string } | null {
  const text = objective.toLowerCase().trim();
  if (!text) return null;

  // Python patterns
  if (
    text.includes("python") ||
    text.includes("django") ||
    text.includes("fastapi") ||
    text.includes("pandas") ||
    text.includes("numpy") ||
    text.includes("flask") ||
    text.includes("scripting") ||
    /\b(py|python3|coding|developer|programming|backend)\b/.test(text)
  ) {
    return { id: "python-junior", name: "Python" };
  }

  // Mathematics patterns
  if (
    text.includes("math") ||
    text.includes("matemat") ||
    text.includes("algebra") ||
    text.includes("calculus") ||
    text.includes("geometry") ||
    text.includes("statistics") ||
    text.includes("equation") ||
    text.includes("exam") ||
    text.includes("vestibular") ||
    text.includes("enem") ||
    text.includes("sat") ||
    text.includes("gre") ||
    text.includes("arithmetic")
  ) {
    return { id: "math-exams", name: "Mathematics" };
  }

  // Excel patterns
  if (
    text.includes("excel") ||
    text.includes("spreadsheet") ||
    text.includes("sheets") ||
    text.includes("vlookup") ||
    text.includes("xlookup") ||
    text.includes("pivot") ||
    text.includes("planilha") ||
    text.includes("financial analysis") ||
    text.includes("business analysis") ||
    text.includes("formula") ||
    text.includes("csv")
  ) {
    return { id: "excel-pro", name: "Excel" };
  }

  return null;
}
