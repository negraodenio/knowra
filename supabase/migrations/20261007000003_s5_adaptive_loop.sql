-- ============================================================
-- SPRINT 5 — ADAPTIVE LOOP: RECOMMENDATIONS + NEXT BEST ACTION
-- Extends recommendations table with learning_goal_id,
-- lifecycle timestamps, algorithm versioning, and status constraints.
-- ============================================================

-- 1. Extend recommendations table (§13, §50)
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS presented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Modify priority column to support 0-100 score representation (§15)
ALTER TABLE public.recommendations
  ALTER COLUMN priority TYPE NUMERIC(5, 2);

-- 3. Update status check constraint for full recommendation lifecycle (§13, §27)
ALTER TABLE public.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_status_check;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_status_check
  CHECK (status IN ('PENDING', 'PRESENTED', 'ACCEPTED', 'SKIPPED', 'COMPLETED', 'EXPIRED'));

-- 4. Indexes for fast active recommendation query and lifecycle queries (§50)
CREATE INDEX IF NOT EXISTS idx_recommendations_goal ON public.recommendations(learning_goal_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON public.recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_goal_status ON public.recommendations(user_id, learning_goal_id, status);
