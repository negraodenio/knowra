import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { CURATED_DOMAINS } from "../lib/learning/domains";
import { ALL_CURATED_COMPETENCIES } from "../lib/learning/curriculum";
import { ALL_DIAGNOSTIC_ITEMS } from "../lib/learning/diagnostic/curriculum";
import { CURATED_ASSESSMENT_BLUEPRINTS } from "../lib/learning/assessment/curriculum/blueprints";
import { CURATED_INDEPENDENT_ASSESSMENT_ITEMS } from "../lib/learning/assessment/curriculum/items";

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const p = path.resolve(process.cwd(), file);
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log("Seeding curated curriculum to Supabase...");

  // 1. Seed Domains
  for (const domain of Object.values(CURATED_DOMAINS)) {
    const { error } = await supabase.from("domains").upsert({
      id: domain.id,
      name: domain.name,
      description: domain.description,
      category: domain.primaryCategory,
      is_curated: domain.isCurated,
      status: domain.status,
    });
    if (error) {
      console.error(`Error inserting domain ${domain.id}:`, error);
      throw error;
    }
  }
  console.log("✓ Domains seeded");

  // 2. Seed Competencies
  for (const comp of ALL_CURATED_COMPETENCIES) {
    const { error } = await supabase.from("competencies").upsert({
      id: comp.id,
      domain_id: comp.domainId,
      title: comp.title,
      description: comp.description,
      category: comp.category,
      difficulty: comp.difficulty,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    });
    if (error) {
      console.error(`Error inserting competency ${comp.id}:`, error);
      throw error;
    }
  }
  console.log("✓ Competencies seeded");

  // 3. Seed Prerequisites
  for (const comp of ALL_CURATED_COMPETENCIES) {
    for (const prereqId of comp.prerequisites) {
      const { error } = await supabase.from("competency_prerequisites").upsert({
        competency_id: comp.id,
        prerequisite_id: prereqId,
      });
      if (error) {
        console.error(`Error inserting prerequisite ${comp.id} -> ${prereqId}:`, error);
        throw error;
      }
    }
  }
  console.log("✓ Prerequisites seeded");

  // 4. Seed Diagnostic Items
  for (const item of ALL_DIAGNOSTIC_ITEMS) {
    const { error } = await supabase.from("diagnostic_items").upsert({
      id: item.id,
      domain_id: item.domainId,
      competency_id: item.competencyId,
      prompt: item.prompt,
      item_type: item.itemType,
      difficulty: item.difficulty,
      options: item.options ? JSON.stringify(item.options) : null,
      correct_answer: item.correctAnswer,
      explanation: item.explanation || "",
      version: item.version || 1,
      provenance: item.provenance || "CURATED",
      status: "ACTIVE",
    });
    if (error) {
      console.error(`Error inserting diagnostic item ${item.id}:`, error);
      throw error;
    }
  }
  console.log("✓ Diagnostic items seeded");

  // 5. Seed S7 Assessment Blueprints
  for (const bp of CURATED_ASSESSMENT_BLUEPRINTS) {
    const { error } = await supabase.from("assessment_blueprints").upsert({
      id: bp.id,
      domain_id: bp.domainId,
      competency_map_version: bp.competencyMapVersion,
      assessment_type: bp.assessmentType,
      target_competencies: JSON.stringify(bp.targetCompetencies),
      difficulty_distribution: JSON.stringify(bp.difficultyDistribution),
      item_count: bp.itemCount,
      passing_threshold: bp.passingThreshold,
      independence_requirements: JSON.stringify(bp.independenceRequirements),
      version: bp.version,
      status: bp.status,
    });
    if (error) {
      console.error(`Error inserting assessment blueprint ${bp.id}:`, error);
      throw error;
    }
  }
  console.log("✓ Assessment blueprints seeded");

  // 6. Seed S7 Independent Assessment Items
  for (const item of CURATED_INDEPENDENT_ASSESSMENT_ITEMS) {
    const { error } = await supabase.from("independent_assessment_items").upsert({
      id: item.id,
      domain_id: item.domainId,
      competency_id: item.competencyId,
      assessment_version: item.assessmentVersion || item.version || "v1",
      item_version: item.itemVersion || 1,
      item_type: item.itemType,
      difficulty: item.difficulty,
      prompt: item.prompt,
      options: item.options ? JSON.stringify(item.options) : null,
      correct_answer: item.correctAnswer,
      explanation: item.explanation || "",
      form_type: item.formType,
      provenance: item.provenance || "CURATED",
      status: item.status || "ACTIVE",
      metadata: JSON.stringify(item.metadata || {}),
    });
    if (error) {
      console.error(`Error inserting independent assessment item ${item.id}:`, error);
      throw error;
    }
  }
  console.log("✓ Independent assessment items seeded");

  console.log("Database seeded successfully with all curated domains, competencies, diagnostic items, blueprints, and independent assessment items.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
