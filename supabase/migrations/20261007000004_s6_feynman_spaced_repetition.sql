-- ============================================================
-- SPRINT 6 — FEYNMAN + SPACED REPETITION + REVIEW ENGINE
-- Extends review_items and creates feynman_sessions,
-- review_sessions, and review_session_items with strict RLS.
-- ============================================================

-- 1. Extend review_items table (§13, §18)
ALTER TABLE public.review_items
  ADD COLUMN IF NOT EXISTS learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scheduler_type TEXT NOT NULL DEFAULT 'FSRS' CHECK (scheduler_type IN ('FSRS', 'SM2')),
  ADD COLUMN IF NOT EXISTS scheduler_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS scheduler_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_review_items_user_goal_due ON public.review_items(user_id, learning_goal_id, due_at);

-- 2. Feynman Sessions table (§4, §5, §7)
CREATE TABLE IF NOT EXISTS public.feynman_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  learner_explanation TEXT,
  evaluation JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'STARTED', 'SUBMITTED', 'EVALUATED')),
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  submitted_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feynman_sessions_user_goal ON public.feynman_sessions(user_id, learning_goal_id);
CREATE INDEX IF NOT EXISTS idx_feynman_sessions_competency ON public.feynman_sessions(competency_id);
CREATE INDEX IF NOT EXISTS idx_feynman_sessions_status ON public.feynman_sessions(status);

ALTER TABLE public.feynman_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feynman sessions"
  ON public.feynman_sessions FOR ALL
  USING (auth.uid() = user_id);

-- 3. Review Sessions table (§15)
CREATE TABLE IF NOT EXISTS public.review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  item_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(5, 2),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'STARTED', 'COMPLETED', 'ABANDONED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_user_goal ON public.review_sessions(user_id, learning_goal_id);

ALTER TABLE public.review_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own review sessions"
  ON public.review_sessions FOR ALL
  USING (auth.uid() = user_id);

-- 4. Review Session Items table (§15, §17)
CREATE TABLE IF NOT EXISTS public.review_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.review_sessions(id) ON DELETE CASCADE,
  review_item_id UUID NOT NULL REFERENCES public.review_items(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  score NUMERIC(5, 2),
  rating TEXT CHECK (rating IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_review_session_items_session ON public.review_session_items(session_id);

ALTER TABLE public.review_session_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access review session items via session ownership"
  ON public.review_session_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.review_sessions s
      WHERE s.id = review_session_items.session_id AND s.user_id = auth.uid()
    )
  );
