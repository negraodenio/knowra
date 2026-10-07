import { NextResponse } from "next/server";
import { getModel, ModelTask } from "@/lib/ai/models";

export async function GET() {
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const isOpenRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);

  const resolveSafe = (task: ModelTask) => {
    try {
      return getModel(task);
    } catch {
      return "NOT_CONFIGURED";
    }
  };

  const configuredModels = {
    tutor: resolveSafe("tutor"),
    feynman: resolveSafe("feynman"),
    classifier: resolveSafe("classifier"),
    diagnostic: resolveSafe("diagnostic"),
    plan: resolveSafe("plan"),
    competency: resolveSafe("competency"),
    assessment: resolveSafe("assessment"),
    material: resolveSafe("material"),
  };

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    sprint: "S1",
    services: {
      supabaseConfigured: isSupabaseConfigured,
      openRouterConfigured: isOpenRouterConfigured,
    },
    models: configuredModels,
  });
}
