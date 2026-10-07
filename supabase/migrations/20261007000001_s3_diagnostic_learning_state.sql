-- ============================================================
-- SPRINT 3 — DIAGNOSTIC + LEARNING STATE MIGRATION
-- Adds dedicated diagnostic sessions, items pool, responses,
-- and links baseline state and map versioning to learner state.
-- ============================================================

-- 1. Extend competency_states with baseline_score & goal link (§18, §19)
ALTER TABLE public.competency_states
  ADD COLUMN IF NOT EXISTS learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS baseline_score NUMERIC(5, 2);

-- 2. Extend learning_profiles with map_version_id and self_reported_level (§17)
ALTER TABLE public.learning_profiles
  ADD COLUMN IF NOT EXISTS map_version_id TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS self_reported_level TEXT;

-- 3. Extend evidence with goal link and map_version freeze (§15, §25)
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS map_version TEXT DEFAULT '1.0.0';

-- 4. Diagnostic Sessions Table (§13)
CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_goal_id UUID NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  map_version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
  overall_baseline_score NUMERIC(5, 2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_user ON public.diagnostic_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_goal ON public.diagnostic_sessions(learning_goal_id);

ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own diagnostic sessions"
  ON public.diagnostic_sessions FOR ALL
  USING (auth.uid() = user_id);

-- 5. Diagnostic Items Pool Table (§9, §10)
CREATE TABLE IF NOT EXISTS public.diagnostic_items (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'NUMERIC', 'TRUE_FALSE')),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  provenance TEXT NOT NULL DEFAULT 'CURATED' CHECK (provenance IN ('CURATED', 'AI_GENERATED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'DEPRECATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_diag_items_domain ON public.diagnostic_items(domain_id);
CREATE INDEX IF NOT EXISTS idx_diag_items_competency ON public.diagnostic_items(competency_id);

ALTER TABLE public.diagnostic_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view diagnostic items"
  ON public.diagnostic_items FOR SELECT
  TO authenticated
  USING (true);

-- 6. Diagnostic Responses Table (§14)
CREATE TABLE IF NOT EXISTS public.diagnostic_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES public.diagnostic_items(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  response_time_ms INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_diag_resp_session ON public.diagnostic_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_diag_resp_user ON public.diagnostic_responses(user_id);

ALTER TABLE public.diagnostic_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own diagnostic responses"
  ON public.diagnostic_responses FOR ALL
  USING (auth.uid() = user_id);
