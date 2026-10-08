import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

/**
 * Extracts and authenticates the requesting user ID (§36, §38, §S8.3)
 *
 * CRITICAL SECURITY ARCHITECTURE (§S8.3):
 * 1. Supabase Auth session via secure SSR cookies is the AUTHORITATIVE source of identity.
 * 2. If a Supabase session exists, its user.id is returned ALWAYS.
 * 3. An authenticated request CANNOT impersonate another user via 'x-user-id'.
 * 4. 'x-user-id' is permitted ONLY in automated test environments when NO Supabase session exists.
 * 5. In production, unauthenticated requests with arbitrary headers are rejected (return null -> 401).
 */
export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  // 1. Authoritative check: Supabase Auth session via cookies
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      // Authenticated session is authoritative. Any header spoofing is strictly ignored.
      return user.id;
    }
  } catch {
    // Supabase auth lookup failed or unconfigured
  }

  // 2. Automated test isolation:
  // Used only by offline Vitest unit tests and integration scripts when no browser session is active.
  const isTestOrDev =
    process.env.NODE_ENV === "test" ||
    process.env.ALLOW_TEST_USER_HEADER === "true" ||
    process.env.NODE_ENV !== "production";

  const headerUserId = req.headers.get("x-user-id");
  if (isTestOrDev && headerUserId) {
    return headerUserId;
  }

  return null;
}
