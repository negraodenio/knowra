import { createClient } from "@supabase/supabase-js";

/**
 * Service Role Supabase Client (§38)
 * CRITICAL SECURITY RULE:
 * This client bypasses RLS and MUST ONLY be used server-side in secure background jobs
 * or scoped administrative procedures. Never expose to client/browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined in the environment.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
