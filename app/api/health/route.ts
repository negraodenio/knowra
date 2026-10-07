import { NextResponse } from "next/server";
import { getModelForTask } from "@/lib/ai/models";

export async function GET() {
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const isOpenRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);

  const configuredModels = {
    tutor: getModelForTask("TUTOR"),
    feynman: getModelForTask("FEYNMAN"),
    classifier: getModelForTask("CLASSIFIER"),
    diagnostic: getModelForTask("DIAGNOSTIC"),
    plan: getModelForTask("PLAN"),
    competency: getModelForTask("COMPETENCY"),
    assessment: getModelForTask("ASSESSMENT"),
    material: getModelForTask("MATERIAL"),
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
