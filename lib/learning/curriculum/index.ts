import { Competency } from "../types";
import { PYTHON_COMPETENCIES } from "./python";
import { MATHEMATICS_COMPETENCIES } from "./mathematics";
import { EXCEL_COMPETENCIES } from "./excel";

export { PYTHON_COMPETENCIES } from "./python";
export { MATHEMATICS_COMPETENCIES } from "./mathematics";
export { EXCEL_COMPETENCIES } from "./excel";

export const ALL_CURATED_COMPETENCIES: Competency[] = [
  ...PYTHON_COMPETENCIES,
  ...MATHEMATICS_COMPETENCIES,
  ...EXCEL_COMPETENCIES,
];

export function getCuratedCompetenciesByDomain(domainId: string): Competency[] {
  switch (domainId) {
    case "python-junior":
      return PYTHON_COMPETENCIES;
    case "math-exams":
      return MATHEMATICS_COMPETENCIES;
    case "excel-pro":
      return EXCEL_COMPETENCIES;
    default:
      return [];
  }
}

export function getCompetencyById(competencyId: string): Competency | undefined {
  return ALL_CURATED_COMPETENCIES.find((c) => c.id === competencyId);
}
