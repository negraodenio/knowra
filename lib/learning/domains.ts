import { z } from "zod";
import { CompetencyCategorySchema } from "./types";

export const DomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  primaryCategory: CompetencyCategorySchema,
  isCurated: z.boolean().default(true),
  status: z.enum(["ACTIVE", "EXPERIMENTAL", "DEPRECATED"]).default("ACTIVE"),
  version: z.string().default("1.0.0"),
});

export type Domain = z.infer<typeof DomainSchema>;

/**
 * Three Curated MVP Domains (§5)
 * 1. Python beginner -> junior (Conceptual + technical)
 * 2. Mathematics for exams (Conceptual + academic)
 * 3. Excel for professionals (Procedural + practical)
 */
export const CURATED_DOMAINS: Record<string, Domain> = {
  "python-junior": {
    id: "python-junior",
    name: "Python: Beginner to Junior Developer",
    description: "Core programming paradigms, control flow, functions, data structures, and software engineering foundations in Python.",
    primaryCategory: "CONCEPTUAL",
    isCurated: true,
    status: "ACTIVE",
    version: "1.0.0",
  },
  "math-exams": {
    id: "math-exams",
    name: "Mathematics for Exams",
    description: "Algebra, linear and quadratic systems, functions, coordinate geometry, and foundational applied statistics.",
    primaryCategory: "CONCEPTUAL",
    isCurated: true,
    status: "ACTIVE",
    version: "1.0.0",
  },
  "excel-pro": {
    id: "excel-pro",
    name: "Excel & Spreadsheets for Professionals",
    description: "Business analytics, lookup functions (XLOOKUP/INDEX-MATCH), Pivot Tables, logical formulas, and data preparation.",
    primaryCategory: "PROCEDURAL",
    isCurated: true,
    status: "ACTIVE",
    version: "1.0.0",
  },
};

export function getDomain(domainId: string): Domain | undefined {
  return CURATED_DOMAINS[domainId];
}

export function getAllCuratedDomains(): Domain[] {
  return Object.values(CURATED_DOMAINS);
}
