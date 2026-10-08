-- ============================================================
-- SPRINT 7: EXPAND EVIDENCE_TYPE CHECK CONSTRAINT
-- Migration: 20261007000007_s7_evidence_type_expansion.sql
-- Supports S7 BASELINE_ASSESSMENT, RETENTION_D7, RETENTION_D30
-- ============================================================

ALTER TABLE public.evidence DROP CONSTRAINT IF EXISTS evidence_evidence_type_check;

ALTER TABLE public.evidence ADD CONSTRAINT evidence_evidence_type_check 
  CHECK (evidence_type IN (
    'DIAGNOSTIC', 
    'EXERCISE', 
    'PRACTICE', 
    'FEYNMAN', 
    'REVIEW', 
    'APPLICATION', 
    'FINAL_ASSESSMENT',
    'BASELINE_ASSESSMENT',
    'RETENTION_D7',
    'RETENTION_D30'
  ));
