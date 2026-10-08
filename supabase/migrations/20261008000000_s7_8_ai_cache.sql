-- Migration: 20261008000000_s7_8_ai_cache.sql
-- Sprint: S7.8 — AI CACHE + SUPABASE PGVECTOR (§S7.8)
-- Implements L1 Exact Cache and L2 Semantic Cache using PostgreSQL and pgvector.
-- Preserves Learning Engine source of truth and enforces strict cross-user isolation.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create AI Response Cache table
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key_hash VARCHAR(64) NOT NULL UNIQUE,
    task TEXT NOT NULL,
    cache_type TEXT NOT NULL DEFAULT 'EXACT' CHECK (cache_type IN ('EXACT', 'SEMANTIC')),
    scope TEXT NOT NULL CHECK (scope IN ('SHARED', 'USER_CONTEXTUAL', 'DISABLED')),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    model_version TEXT,
    prompt_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    domain_id TEXT REFERENCES public.domains(id) ON DELETE SET NULL,
    competency_id TEXT REFERENCES public.competencies(id) ON DELETE SET NULL,
    normalized_input TEXT NOT NULL,
    context_fingerprint TEXT,
    response_payload JSONB NOT NULL,
    response_hash VARCHAR(64) NOT NULL,
    embedding vector(1536),
    validation_status TEXT NOT NULL DEFAULT 'VALIDATED' CHECK (validation_status IN ('VALIDATED', 'INVALIDATED')),
    quality_status TEXT NOT NULL DEFAULT 'PASSED' CHECK (quality_status IN ('PASSED', 'FLAGGED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    hit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_hit_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ai_cache_task_model ON public.ai_response_cache(task, model, scope, expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_id ON public.ai_response_cache(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON public.ai_response_cache(expires_at);

-- 4. Vector Cosine HNSW Index for L2 Semantic Cache
CREATE INDEX IF NOT EXISTS idx_ai_cache_embedding_hnsw
    ON public.ai_response_cache
    USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;

-- 5. Row Level Security (§S7.8 Section 30)
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (Server-side AI Gateway uses Service Role)
DROP POLICY IF EXISTS "Service role has full access to ai_response_cache" ON public.ai_response_cache;
CREATE POLICY "Service role has full access to ai_response_cache"
    ON public.ai_response_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated learners can only read shared cache or their own contextual cache
DROP POLICY IF EXISTS "Learners can read shared or own contextual cache" ON public.ai_response_cache;
CREATE POLICY "Learners can read shared or own contextual cache"
    ON public.ai_response_cache
    FOR SELECT
    TO authenticated
    USING (
        scope = 'SHARED' OR
        (scope = 'USER_CONTEXTUAL' AND user_id = auth.uid())
    );

-- 6. Stored Procedure for conservative Semantic Cache vector lookup (§S7.8 Section 11, 34)
CREATE OR REPLACE FUNCTION public.match_ai_cache(
    query_embedding vector(1536),
    match_threshold DOUBLE PRECISION,
    match_count INTEGER,
    p_task TEXT,
    p_model TEXT,
    p_prompt_version TEXT,
    p_schema_version TEXT,
    p_policy_version TEXT,
    p_scope TEXT DEFAULT 'SHARED',
    p_user_id UUID DEFAULT NULL,
    p_domain_id TEXT DEFAULT NULL,
    p_competency_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    cache_key_hash VARCHAR(64),
    task TEXT,
    model TEXT,
    scope TEXT,
    response_payload JSONB,
    similarity DOUBLE PRECISION,
    hit_count INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.cache_key_hash,
        c.task,
        c.model,
        c.scope,
        c.response_payload,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.hit_count,
        c.created_at
    FROM public.ai_response_cache c
    WHERE
        c.embedding IS NOT NULL
        AND c.task = p_task
        AND c.model = p_model
        AND c.prompt_version = p_prompt_version
        AND c.schema_version = p_schema_version
        AND c.policy_version = p_policy_version
        AND c.validation_status = 'VALIDATED'
        AND c.quality_status = 'PASSED'
        AND c.expires_at > timezone('utc'::text, now())
        AND (
            (p_scope = 'SHARED' AND c.scope = 'SHARED') OR
            (p_scope = 'USER_CONTEXTUAL' AND c.scope = 'USER_CONTEXTUAL' AND c.user_id = p_user_id)
        )
        AND (p_domain_id IS NULL OR c.domain_id IS NULL OR c.domain_id = p_domain_id)
        AND (p_competency_id IS NULL OR c.competency_id IS NULL OR c.competency_id = p_competency_id)
        AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
