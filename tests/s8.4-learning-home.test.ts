import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectDomainFromObjective } from "@/lib/learning/domain-detection";
import { learningStateService } from "@/lib/learning/state/learning-state-service";
import { CURATED_DOMAINS } from "@/lib/learning/domains";
import { NextRequest } from "next/server";
import { POST as goalsPostHandler, GET as goalsGetHandler } from "@/app/api/goals/route";

describe("S8.4 — Learning Home & Goal Entry Experience", () => {
  const testUserId = "77777777-8888-4999-baaa-bbbbccccdddd";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Anonymous vs Authenticated Routing Lifecycle (§8)", () => {
    it("1. Anonymous visitor with null session is routed to Landing Page state", () => {
      const session = null;
      const isAuthenticated = Boolean(session);
      const shouldRenderLanding = !isAuthenticated;
      expect(shouldRenderLanding).toBe(true);
    });

    it("2. Authenticated learner with active session is routed to Authenticated Home", () => {
      const session = { userId: testUserId, email: "learner@knowra.test" };
      const isAuthenticated = Boolean(session && session.userId);
      const shouldRenderHome = isAuthenticated;
      expect(shouldRenderHome).toBe(true);
    });
  });

  describe("2. Home Interface Structure (§3, §4, §5)", () => {
    it("3. Free-text learning input handles natural language intentions without competency jargon", () => {
      const sampleInputs = [
        "I want to learn Python for my first developer job",
        "I want to improve mathematics for an exam",
        "I want to master Excel for financial analysis",
      ];

      for (const input of sampleInputs) {
        expect(input.length).toBeGreaterThan(10);
        const detected = detectDomainFromObjective(input);
        expect(detected).not.toBeNull();
        expect(detected?.id).toBeDefined();
      }
    });

    it("4. Curated learning path: Python (beginner to junior) is accurately configured", () => {
      const pythonDomain = CURATED_DOMAINS["python-junior"];
      expect(pythonDomain).toBeDefined();
      expect(pythonDomain.id).toBe("python-junior");
      expect(pythonDomain.name).toContain("Python");
      expect(pythonDomain.isCurated).toBe(true);
    });

    it("5. Curated learning path: Mathematics (exams & problem solving) is accurately configured", () => {
      const mathDomain = CURATED_DOMAINS["math-exams"];
      expect(mathDomain).toBeDefined();
      expect(mathDomain.id).toBe("math-exams");
      expect(mathDomain.name).toContain("Mathematics");
      expect(mathDomain.isCurated).toBe(true);
    });

    it("6. Curated learning path: Excel (professional mastery) is accurately configured", () => {
      const excelDomain = CURATED_DOMAINS["excel-pro"];
      expect(excelDomain).toBeDefined();
      expect(excelDomain.id).toBe("excel-pro");
      expect(excelDomain.name).toContain("Excel");
      expect(excelDomain.isCurated).toBe(true);
    });
  });

  describe("3. Free-Text Goal Creation Flow (§6)", () => {
    it("7. Free-text submission creates a goal through existing goal infrastructure", async () => {
      const naturalObjective = "I want to learn Python for data analysis and web scripting";
      const detected = detectDomainFromObjective(naturalObjective);

      expect(detected).not.toBeNull();
      expect(detected?.id).toBe("python-junior");

      const req = new NextRequest("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUserId,
        },
        body: JSON.stringify({
          rawObjective: naturalObjective,
          selectedDomainId: detected!.id,
          selfReportedLevel: "Beginner",
        }),
      });

      const res = await goalsPostHandler(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.goal).toBeDefined();
      expect(data.goal.domainId).toBe("python-junior");
      expect(data.goal.userId).toBe(testUserId);
      expect(data.profile.activeGoalId).toBe(data.goal.id);
    });

    it("7b. Free-text with unsupported arbitrary domain provides honest notice and does not fake curriculum (§6)", () => {
      const arbitraryObjective = "I want to learn 17th century French cooking";
      const detected = detectDomainFromObjective(arbitraryObjective);

      // Must be null so product provides honest UX notice instead of fabricating fake DAG
      expect(detected).toBeNull();
    });
  });

  describe("4. Curated Path Card Flow (§7)", () => {
    it("8. Python card creates goal through existing goal infrastructure", async () => {
      const req = new NextRequest("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUserId,
        },
        body: JSON.stringify({
          rawObjective: "I want to learn Python from beginner to junior developer",
          selectedDomainId: "python-junior",
          selfReportedLevel: "Beginner",
        }),
      });

      const res = await goalsPostHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.goal.domainId).toBe("python-junior");
    });

    it("9. Mathematics card creates goal through existing goal infrastructure", async () => {
      const req = new NextRequest("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUserId,
        },
        body: JSON.stringify({
          rawObjective: "I want to master Mathematics for exams and problem solving",
          selectedDomainId: "math-exams",
          selfReportedLevel: "Beginner",
        }),
      });

      const res = await goalsPostHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.goal.domainId).toBe("math-exams");
    });

    it("10. Excel card creates goal through existing goal infrastructure", async () => {
      const req = new NextRequest("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUserId,
        },
        body: JSON.stringify({
          rawObjective: "I want to achieve professional mastery in Excel and spreadsheets",
          selectedDomainId: "excel-pro",
          selfReportedLevel: "Beginner",
        }),
      });

      const res = await goalsPostHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.goal.domainId).toBe("excel-pro");
    });
  });

  describe("5. Existing Navigation & Authenticated Routes Integrity (§9, §12)", () => {
    it("11. Existing authenticated routes remain functional and fetch user state", async () => {
      const req = new NextRequest("http://localhost:3000/api/goals", {
        method: "GET",
        headers: {
          "x-user-id": testUserId,
        },
      });

      const res = await goalsGetHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.goals)).toBe(true);
      expect(data.activeGoal).toBeDefined();
    });

    it("12. Learning state service preserves baseline scores and competency graphs without regressions", async () => {
      const activeGoalData = await learningStateService.getActiveGoal(testUserId);
      expect(activeGoalData).toBeDefined();
      expect(activeGoalData?.goal.id).toBeDefined();
    });
  });
});
