import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

/**
 * Extracts and authenticates the requesting user ID (§36, §38)
 * Checks session via Supabase server client, with x-user-id header support for testing.
 */
export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  // Support explicit test / authorization header
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) {
    return headerUserId;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }
  } catch {
    // Supabase auth lookup failed or unconfigured
  }

  return null;
}
