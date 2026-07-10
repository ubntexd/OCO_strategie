-- db/dev_schema.sql — Orchestration développement (DASHBOARD_DEV_ORCHESTRATION.md §5)

CREATE TABLE IF NOT EXISTS dev_pipeline_state (
  id             SERIAL PRIMARY KEY,
  status         TEXT NOT NULL CHECK (status IN ('IDLE', 'RUNNING', 'PAUSED', 'DONE', 'FAILED')),
  current_module CHAR(1) CHECK (current_module IN ('B', 'A', 'C', 'I')),
  current_task   TEXT,
  started_at     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_reports (
  id            SERIAL PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  agent_role    TEXT,
  module        CHAR(1),
  task          TEXT,
  status        TEXT NOT NULL CHECK (status IN ('started', 'done', 'fail', 'retry')),
  message       TEXT,
  files_changed JSONB,
  doc_reference TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_test_results (
  id                    SERIAL PRIMARY KEY,
  scope                 TEXT NOT NULL,
  tests_pass            INT NOT NULL,
  tests_total           INT NOT NULL,
  coverage_pct          NUMERIC(5, 2),
  coverage_required_pct NUMERIC(5, 2),
  coverage_ok           BOOLEAN,
  command               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_validation_results (
  id         SERIAL PRIMARY KEY,
  scope      TEXT NOT NULL,
  checklist  TEXT,
  items      JSONB NOT NULL,
  fail_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_gate_verdicts (
  id             SERIAL PRIMARY KEY,
  step           TEXT NOT NULL,
  verdict        TEXT NOT NULL CHECK (verdict IN ('GO', 'NO_GO')),
  reasons        JSONB,
  doc_references JSONB,
  next_action    TEXT,
  failed_agents  JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_agent_status (
  agent_id    TEXT PRIMARY KEY,
  agent_role  TEXT,
  status      TEXT NOT NULL,
  last_task   TEXT,
  last_report TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_reports_agent ON dev_reports (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_gate_verdicts_step ON dev_gate_verdicts (step, created_at DESC);

INSERT INTO dev_agent_status (agent_id, agent_role, status, last_task) VALUES
  ('coworker-1', 'Module B — Risk & Data', 'idle', NULL),
  ('coworker-2', 'Module A — Trading Core', 'idle', NULL),
  ('coworker-3', 'Module C — Ops Platform', 'idle', NULL),
  ('coworker-4', 'Infra & QA', 'idle', NULL),
  ('superviseur', 'Orchestration', 'idle', NULL),
  ('testeur', 'Jest CD §9', 'idle', NULL),
  ('validateur', 'Checklists L1–L16', 'idle', NULL),
  ('coworker-claude-ia', 'GO / NO GO', 'idle', NULL)
ON CONFLICT (agent_id) DO NOTHING;
