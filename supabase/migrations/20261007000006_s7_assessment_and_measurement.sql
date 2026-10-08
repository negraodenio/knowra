-- ============================================================
-- SPRINT 7: ASSESSMENT & MEASUREMENT ENGINE SCHEMA
-- Migration: 20261007000006_s7_assessment_and_measurement.sql
-- Independent Assessment, Learning Gain, D7/D30 Retention
-- ============================================================

-- 1. Assessment Blueprints Table
CREATE TABLE IF NOT EXISTS public.assessment_blueprints (
    id TEXT PRIMARY KEY,
    domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    competency_map_version TEXT NOT NULL DEFAULT '1.0.0',
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('BASELINE', 'FINAL', 'RETENTION_D7', 'RETENTION_D30')),
    target_competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    difficulty_distribution JSONB NOT NULL DEFAULT '{"easy": 30, "medium": 50, "hard": 20}'::jsonb,
    item_count INTEGER NOT NULL DEFAULT 5,
    passing_threshold NUMERIC(5, 2) NOT NULL DEFAULT 70.00,
    independence_requirements JSONB NOT NULL DEFAULT '{"disallow_baseline_item_ids": true, "max_semantic_similarity": 0.6}'::jsonb,
    version TEXT NOT NULL DEFAULT 'v1',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'DEPRECATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Independent Assessment Items Table (Versioned, Independent from Baseline)
CREATE TABLE IF NOT EXISTS public.independent_assessment_items (
    id TEXT PRIMARY KEY,
    domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
    assessment_version TEXT NOT NULL DEFAULT 'v1',
    item_version INTEGER NOT NULL DEFAULT 1,
    item_type TEXT NOT NULL CHECK (item_type IN ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'NUMERIC', 'TRUE_FALSE')),
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    prompt TEXT NOT NULL,
    options JSONB DEFAULT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    form_type TEXT NOT NULL CHECK (form_type IN ('BASELINE', 'FINAL', 'RETENTION_D7', 'RETENTION_D30')),
    provenance TEXT NOT NULL DEFAULT 'CURATED' CHECK (provenance IN ('CURATED', 'AI_GENERATED')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'DEPRECATED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Independent Assessment Sessions Table
CREATE TABLE IF NOT EXISTS public.independent_assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    learning_goal_id UUID NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    blueprint_id TEXT NOT NULL REFERENCES public.assessment_blueprints(id) ON DELETE RESTRICT,
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('BASELINE', 'FINAL', 'RETENTION_D7', 'RETENTION_D30')),
    form_version TEXT NOT NULL DEFAULT 'v1',
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'SCORED', 'COMPLETED', 'EXPIRED')),
    overall_score NUMERIC(5, 2) DEFAULT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    submitted_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Independent Assessment Responses Table
CREATE TABLE IF NOT EXISTS public.independent_assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.independent_assessment_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.independent_assessment_items(id) ON DELETE RESTRICT,
    competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    response_time_ms INTEGER DEFAULT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Learning Gains Table (Primary S7 Product Metric)
CREATE TABLE IF NOT EXISTS public.learning_gains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    learning_goal_id UUID NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    baseline_session_id TEXT NOT NULL,
    baseline_score NUMERIC(5, 2) NOT NULL,
    final_session_id UUID NOT NULL REFERENCES public.independent_assessment_sessions(id) ON DELETE CASCADE,
    final_score NUMERIC(5, 2) NOT NULL,
    learning_gain NUMERIC(5, 2) NOT NULL, -- final_score - baseline_score
    relative_gain NUMERIC(5, 4) DEFAULT NULL, -- normalized relative gain
    competency_gains JSONB NOT NULL DEFAULT '[]'::jsonb,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Retention Records Table (D7 / D30 Retention)
CREATE TABLE IF NOT EXISTS public.retention_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    learning_goal_id UUID NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    final_session_id UUID NOT NULL REFERENCES public.independent_assessment_sessions(id) ON DELETE CASCADE,
    final_score NUMERIC(5, 2) NOT NULL,
    retention_type TEXT NOT NULL CHECK (retention_type IN ('D7', 'D30')),
    retention_session_id UUID NOT NULL REFERENCES public.independent_assessment_sessions(id) ON DELETE CASCADE,
    retention_score NUMERIC(5, 2) NOT NULL,
    retention_ratio NUMERIC(5, 4) NOT NULL, -- retention_score / final_score (guarded)
    gain_retained NUMERIC(5, 2) NOT NULL, -- retention_score - baseline_score
    competency_retention JSONB NOT NULL DEFAULT '[]'::jsonb,
    days_since_final INTEGER NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance & quick foreign-key joins
CREATE INDEX IF NOT EXISTS idx_assessment_blueprints_domain ON public.assessment_blueprints(domain_id);
CREATE INDEX IF NOT EXISTS idx_indep_items_comp ON public.independent_assessment_items(competency_id);
CREATE INDEX IF NOT EXISTS idx_indep_items_form ON public.independent_assessment_items(form_type);
CREATE INDEX IF NOT EXISTS idx_indep_sessions_user_goal ON public.independent_assessment_sessions(user_id, learning_goal_id);
CREATE INDEX IF NOT EXISTS idx_indep_sessions_type ON public.independent_assessment_sessions(assessment_type);
CREATE INDEX IF NOT EXISTS idx_indep_responses_session ON public.independent_assessment_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_gains_user_goal ON public.learning_gains(user_id, learning_goal_id);
CREATE INDEX IF NOT EXISTS idx_retention_records_user_goal ON public.retention_records(user_id, learning_goal_id);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.assessment_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.independent_assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.independent_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.independent_assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_gains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_records ENABLE ROW LEVEL SECURITY;

-- Blueprints & Items: Read-only for authenticated users
CREATE POLICY "Authenticated users can read assessment blueprints"
    ON public.assessment_blueprints FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read independent assessment items"
    ON public.independent_assessment_items FOR SELECT
    TO authenticated
    USING (true);

-- User-scoped sessions
CREATE POLICY "Users can view own independent assessment sessions"
    ON public.independent_assessment_sessions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own independent assessment sessions"
    ON public.independent_assessment_sessions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own independent assessment sessions"
    ON public.independent_assessment_sessions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- User-scoped responses
CREATE POLICY "Users can view own independent assessment responses"
    ON public.independent_assessment_responses FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own independent assessment responses"
    ON public.independent_assessment_responses FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- User-scoped learning gains
CREATE POLICY "Users can view own learning gains"
    ON public.learning_gains FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own learning gains"
    ON public.learning_gains FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- User-scoped retention records
CREATE POLICY "Users can view own retention records"
    ON public.retention_records FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own retention records"
    ON public.retention_records FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
