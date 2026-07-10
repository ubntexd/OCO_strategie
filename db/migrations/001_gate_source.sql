-- Migration : gate_source obligatoire pour traçabilité Claude IA
ALTER TABLE dev_gate_verdicts
  ADD COLUMN IF NOT EXISTS gate_source TEXT NOT NULL DEFAULT 'unknown';
