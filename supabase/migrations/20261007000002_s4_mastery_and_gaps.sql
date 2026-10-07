-- ============================================================
-- SPRINT 4 — MASTERY ENGINE + EVIDENCE CONFIDENCE + GAP DETECTION
-- Extends mastery_snapshots and gaps with learning_goal_id,
-- structured signals, calculation versioning, and severity levels.
-- ============================================================

-- 1. Extend mastery_snapshots table (§19)
ALTER TABLE public.mastery_snapshots
  ADD COLUMN IF NOT EXISTS learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mastery_state TEXT DEFAULT 'DEVELOPING' CHECK (mastery_state IN ('CRITICAL', 'LOW', 'DEVELOPING', 'GOOD', 'MASTERY')),
  ADD COLUMN IF NOT EXISTS calculation_version TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS evidence_summary JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_mastery_snapshots_goal ON public.mastery_snapshots(learning_goal_id);

-- 2. Extend gaps table (§24, §25)
ALTER TABLE public.gaps
  ADD COLUMN IF NOT EXISTS learning_goal_id UUID REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS severity_level TEXT DEFAULT 'MEDIUM' CHECK (severity_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  ADD COLUMN IF NOT EXISTS signals JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_gaps_goal ON public.gaps(learning_goal_id);
CREATE INDEX IF NOT EXISTS idx_gaps_status ON public.gaps(status);
