-- ============================================================
-- UNIVERSAL ADAPTIVE LEARNING PLATFORM (EDUIA)
-- BASELINE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- VERSION: S1 Baseline (2026-10-07)
-- ============================================================

-- Enable pgcrypto for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. USER PROFILES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. DOMAINS & CURATED CURRICULUM
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- CONCEPTUAL, PROCEDURAL, FACTUAL
  is_curated BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view domains"
  ON public.domains FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- 3. COMPETENCIES & PREREQUISITES (§8)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competencies (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('CONCEPTUAL', 'PROCEDURAL', 'FACTUAL')),
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'DEPRECATED')),
  provenance TEXT NOT NULL DEFAULT 'CURATED' CHECK (provenance IN ('CURATED', 'AI_GENERATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_competencies_domain ON public.competencies(domain_id);

ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view competencies"
  ON public.competencies FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.competency_prerequisites (
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  prerequisite_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  PRIMARY KEY (competency_id, prerequisite_id)
);

ALTER TABLE public.competency_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view competency prerequisites"
  ON public.competency_prerequisites FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.competency_map_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.competency_map_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view competency map versions"
  ON public.competency_map_versions FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- 4. LEARNING GOALS & PROFILES (§9, §13)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  raw_objective TEXT NOT NULL,
  normalized_objective TEXT,
  target_outcome TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAUSED', 'ABANDONED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_learning_goals_user ON public.learning_goals(user_id);

ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own learning goals"
  ON public.learning_goals FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE SET NULL,
  domain_id TEXT REFERENCES public.domains(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id)
);

ALTER TABLE public.learning_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning profile"
  ON public.learning_profiles FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. CURRENT COMPETENCY STATES (§13, §37)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competency_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  mastery_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (mastery_score BETWEEN 0 AND 100),
  mastery_state TEXT NOT NULL DEFAULT 'CRITICAL' CHECK (mastery_state IN ('CRITICAL', 'LOW', 'DEVELOPING', 'GOOD', 'MASTERY')),
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.0 CHECK (confidence BETWEEN 0 AND 1),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_competency_states_user ON public.competency_states(user_id);

ALTER TABLE public.competency_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own competency states"
  ON public.competency_states FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. APPEND-ONLY EVIDENCE RECORD (§14, §15, §37)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('DIAGNOSTIC', 'EXERCISE', 'PRACTICE', 'FEYNMAN', 'REVIEW', 'APPLICATION', 'FINAL_ASSESSMENT')),
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE', 'PARTIAL')),
  score NUMERIC(5, 2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  confidence NUMERIC(4, 3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_evidence_user ON public.evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_competency ON public.evidence(competency_id);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON public.evidence(created_at);

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own evidence"
  ON public.evidence FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 7. MASTERY SNAPSHOTS (Longitudinal Analysis §37)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mastery_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  mastery_score NUMERIC(5, 2) NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL,
  snapshot_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mastery_snapshots_user ON public.mastery_snapshots(user_id);

ALTER TABLE public.mastery_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own mastery snapshots"
  ON public.mastery_snapshots FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 8. GAPS & RECOMMENDATIONS (§18, §19, §20)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  severity NUMERIC(4, 3) NOT NULL DEFAULT 0.5,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gaps_user ON public.gaps(user_id);

ALTER TABLE public.gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own gaps"
  ON public.gaps FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('LEARN', 'PRACTICE', 'FEYNMAN', 'REVIEW', 'REMEDIATE', 'RETRY', 'ADVANCE')),
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  priority NUMERIC(4, 3) NOT NULL,
  reason TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'COMPLETED', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user ON public.recommendations(user_id);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own recommendations"
  ON public.recommendations FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9. SPACED REPETITION REVIEW ITEMS (§25)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  stability NUMERIC(6, 3) NOT NULL DEFAULT 1.0,
  difficulty NUMERIC(6, 3) NOT NULL DEFAULT 5.0,
  interval_days INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_review_items_user_due ON public.review_items(user_id, due_date);

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own review items"
  ON public.review_items FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 10. LEARNING SESSIONS (§41)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.learning_goals(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ,
  total_minutes INTEGER,
  actions_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own sessions"
  ON public.learning_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 11. ASSESSMENTS & RESULTS (§11, §12)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('DIAGNOSTIC', 'FINAL')),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
  score NUMERIC(5, 2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own assessments"
  ON public.assessments FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  expected_answer TEXT,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  item_type TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE'
);

ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assessment items for their assessments"
  ON public.assessment_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assessments a WHERE a.id = assessment_items.assessment_id AND a.user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.assessment_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_response TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  evaluator_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own assessment results"
  ON public.assessment_results FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 12. MATERIALS & PROVENANCE (§26)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('EXPLANATION', 'EXAMPLE', 'EXERCISE', 'QUIZ', 'FEYNMAN_PROMPT', 'REVIEW_CARD')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT 'CURATED' CHECK (provenance IN ('CURATED', 'AI_GENERATED')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view materials"
  ON public.materials FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- 13. AI USAGE TELEMETRY & COST AUDIT (§30, §41)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  task TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON public.ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage(created_at);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON public.ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 14. AUDIT LOGS (§36, §38)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);
