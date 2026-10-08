import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { middleware } from "@/middleware";
import * as supabaseServerModule from "@/lib/db/supabase-server";

describe("S8.3 — Real Supabase Authentication & Security Tests", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Authoritative Supabase Identity Resolution (§4, §6)", () => {
    it("resolves user ID from authoritative Supabase session", async () => {
      const mockUserId = "user-1111-2222-3333-4444";
      vi.spyOn(supabaseServerModule, "createServerSupabaseClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId, email: "learner@knowra.edu" } },
            error: null,
          }),
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/goals");
      const resolved = await getAuthenticatedUserId(req);

      expect(resolved).toBe(mockUserId);
    });

    it("CRITICAL SECURITY GATE (§13): Authenticated user CANNOT impersonate another user via x-user-id header", async () => {
      const authenticatedUserA = "user-aaaa-aaaa-aaaa-aaaa";
      const impersonationTargetUserB = "user-bbbb-bbbb-bbbb-bbbb";

      // User A is logged into Supabase
      vi.spyOn(supabaseServerModule, "createServerSupabaseClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: authenticatedUserA, email: "userA@knowra.edu" } },
            error: null,
          }),
        },
      } as any);

      // Malicious request sends User B in x-user-id header
      const req = new NextRequest("http://localhost:3000/api/goals", {
        headers: {
          "x-user-id": impersonationTargetUserB,
        },
      });

      const resolved = await getAuthenticatedUserId(req);

      // MUST strictly resolve to User A, NEVER User B
      expect(resolved).toBe(authenticatedUserA);
      expect(resolved).not.toBe(impersonationTargetUserB);
    });

    it("rejects unauthenticated requests attempting to supply x-user-id in production (§5, §6)", async () => {
      // Simulate production environment
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // No Supabase session
      vi.spyOn(supabaseServerModule, "createServerSupabaseClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("No session"),
          }),
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/goals", {
        headers: {
          "x-user-id": "arbitrary-spoofed-user",
        },
      });

      const resolved = await getAuthenticatedUserId(req);

      // Must reject and return null (which translates to 401 Unauthorized in route handlers)
      expect(resolved).toBeNull();
    });

    it("allows x-user-id in test environment when no browser session is active (§5 Case B)", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";

      vi.spyOn(supabaseServerModule, "createServerSupabaseClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/goals", {
        headers: {
          "x-user-id": "test-learner-isolated",
        },
      });

      const resolved = await getAuthenticatedUserId(req);
      expect(resolved).toBe("test-learner-isolated");
    });
  });

  describe("Route Protection Middleware (§8)", () => {
    it("redirects unauthenticated users attempting to access /diagnostic to /auth", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const req = new NextRequest("http://localhost:3000/diagnostic?goalId=123");
      const res = await middleware(req);

      expect(res.status).toBe(307); // Next.js redirect
      const location = res.headers.get("location");
      expect(location).toContain("/auth");
      expect(location).toContain("redirect=%2Fdiagnostic");
    });

    it("redirects unauthenticated users attempting to access /map, /activity, /progress, /history", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      for (const path of ["/map", "/activity", "/progress", "/history"]) {
        const req = new NextRequest(`http://localhost:3000${path}`);
        const res = await middleware(req);

        expect(res.status).toBe(307);
        const location = res.headers.get("location");
        expect(location).toContain("/auth");
        expect(location).toContain(`redirect=${encodeURIComponent(path)}`);
      }
    });

    it("allows public access to /, /about, and /auth without redirection", async () => {
      for (const path of ["/", "/about", "/auth"]) {
        const req = new NextRequest(`http://localhost:3000${path}`);
        const res = await middleware(req);

        // Status 200 / Next pass-through (not a redirect)
        expect(res.status).not.toBe(307);
      }
    });
  });
});
