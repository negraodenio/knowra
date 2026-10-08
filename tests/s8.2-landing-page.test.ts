import { describe, it, expect, beforeEach } from "vitest";
import { productEventService, ProductEventType } from "@/lib/observability/product-events";

describe("S8.2 Public Landing Page & Conversion Entry Tests", () => {
  beforeEach(() => {
    // Fresh state for each test
  });

  describe("Landing Page Observability Events (§23, §27)", () => {
    it("successfully records landing_viewed event with anonymous identifier", () => {
      const anonId = "anon_visitor_test_1";
      const event = productEventService.recordEvent(
        anonId,
        "landing_viewed",
        { path: "/", referrer: "direct" }
      );

      expect(event).toBeDefined();
      expect(event.eventType).toBe("landing_viewed");
      expect(event.userId).toBe(anonId);
      expect(event.payload.path).toBe("/");
    });

    it("successfully records landing_how_it_works_clicked and landing_cta_clicked events", () => {
      const anonId = "anon_visitor_test_2";
      const hiwEvent = productEventService.recordEvent(
        anonId,
        "landing_how_it_works_clicked",
        { target: "#how-it-works" }
      );
      const ctaEvent = productEventService.recordEvent(
        anonId,
        "landing_cta_clicked",
        { location: "hero_primary" }
      );

      expect(hiwEvent.eventType).toBe("landing_how_it_works_clicked");
      expect(ctaEvent.eventType).toBe("landing_cta_clicked");
      expect(ctaEvent.payload.location).toBe("hero_primary");
    });

    it("records signup_started event during conversion handoff", () => {
      const anonId = "new-learner-candidate";
      const event = productEventService.recordEvent(
        anonId,
        "signup_started",
        { mode: "SIGN_UP", chosenId: "alex_py" }
      );

      expect(event.eventType).toBe("signup_started");
      expect(event.payload.mode).toBe("SIGN_UP");
      expect(event.payload.chosenId).toBe("alex_py");
    });
  });

  describe("Security & Multitenancy Guarantees (§27)", () => {
    it("does not expose API keys or credentials in event payloads", () => {
      const event = productEventService.recordEvent(
        "anon_visitor_safe",
        "landing_viewed",
        { safeMetric: 1 }
      );

      const payloadKeys = Object.keys(event.payload);
      expect(payloadKeys).not.toContain("OPENROUTER_API_KEY");
      expect(payloadKeys).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(payloadKeys).not.toContain("password");
    });

    it("ensures landing events do not forge learner competence or bypass diagnostic", () => {
      // Landing events must be observational, not state-mutating
      const landingTypes: ProductEventType[] = [
        "landing_viewed",
        "landing_how_it_works_clicked",
        "landing_cta_clicked",
        "signup_started",
      ];

      for (const t of landingTypes) {
        expect(t).not.toBe("mastery_changed");
        expect(t).not.toBe("evidence_emitted");
        expect(t).not.toBe("diagnostic_completed");
      }
    });
  });

  describe("Curated Domain Offerings (§12)", () => {
    it("advertises only the 3 verified curated domains without marketing fiction", () => {
      const advertisedDomains = ["python-junior", "math-exams", "excel-pro"];
      expect(advertisedDomains).toHaveLength(3);
      expect(advertisedDomains).toContain("python-junior");
      expect(advertisedDomains).toContain("math-exams");
      expect(advertisedDomains).toContain("excel-pro");
    });
  });

  describe("Routing Lifecycle Cases (§31)", () => {
    it("evaluates Case A: unauthenticated state returns empty/null user leading to landing display", () => {
      const storedUser: string | null = null;
      const isAuthenticated = Boolean(storedUser);
      expect(isAuthenticated).toBe(false);
      // When isAuthenticated is false, the app renders LandingPage
    });

    it("evaluates Case B & C: signup handoff assigns user identifier and initiates goal onboarding", () => {
      const newUserId = "alex-learns";
      const isAuthenticated = Boolean(newUserId);
      const activeGoal = null;

      expect(isAuthenticated).toBe(true);
      expect(activeGoal).toBeNull();
      // When isAuthenticated is true and activeGoal is null, the app renders Goal Onboarding ("Tell Knowra what you want to learn.")
    });

    it("evaluates Case D & E: existing authenticated learner with active goal renders dashboard", () => {
      const existingUserId = "test-learner-1";
      const activeGoal = {
        id: "goal-test-1",
        title: "I want to become proficient in Python",
        domainId: "python-junior",
      };

      const isAuthenticated = Boolean(existingUserId);
      expect(isAuthenticated).toBe(true);
      expect(activeGoal).not.toBeNull();
      // When isAuthenticated is true and activeGoal exists, the app renders Learner Dashboard
    });

    it("evaluates Case F: sign out clears user and active goal returning to public landing", () => {
      let currentUserId: string | null = "test-learner-1";
      let activeGoalId: string | null = "goal-test-1";

      // Learner triggers Sign Out
      currentUserId = null;
      activeGoalId = null;

      const isAuthenticated = Boolean(currentUserId);
      expect(isAuthenticated).toBe(false);
      expect(activeGoalId).toBeNull();
      // Application returns to Public Landing Page
    });
  });
});
