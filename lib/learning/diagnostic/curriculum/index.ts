import { DiagnosticItem } from "../types";
import { PYTHON_DIAGNOSTIC_ITEMS } from "./python";
import { MATHEMATICS_DIAGNOSTIC_ITEMS } from "./mathematics";
import { EXCEL_DIAGNOSTIC_ITEMS } from "./excel";

export { PYTHON_DIAGNOSTIC_ITEMS } from "./python";
export { MATHEMATICS_DIAGNOSTIC_ITEMS } from "./mathematics";
export { EXCEL_DIAGNOSTIC_ITEMS } from "./excel";

export const ALL_DIAGNOSTIC_ITEMS: DiagnosticItem[] = [
  ...PYTHON_DIAGNOSTIC_ITEMS,
  ...MATHEMATICS_DIAGNOSTIC_ITEMS,
  ...EXCEL_DIAGNOSTIC_ITEMS,
];

export function getDiagnosticItemsByDomain(domainId: string): DiagnosticItem[] {
  switch (domainId) {
    case "python-junior":
      return PYTHON_DIAGNOSTIC_ITEMS;
    case "math-exams":
      return MATHEMATICS_DIAGNOSTIC_ITEMS;
    case "excel-pro":
      return EXCEL_DIAGNOSTIC_ITEMS;
    default:
      return [];
  }
}

export function getDiagnosticItemById(itemId: string): DiagnosticItem | undefined {
  return ALL_DIAGNOSTIC_ITEMS.find((item) => item.id === itemId);
}
