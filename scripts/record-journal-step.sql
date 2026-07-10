INSERT INTO dev_reports (agent_id, agent_role, module, task, status, message, doc_reference)
VALUES ('coworker-1', 'Module B', 'B', 'src/journal.js', 'done', 'journal.js CD 4.5', 'CD 4.5');

INSERT INTO dev_test_results (scope, tests_pass, tests_total, coverage_pct, coverage_required_pct, coverage_ok, command)
VALUES ('src/journal.js', 17, 17, 91, 80, true, 'npm test');

INSERT INTO dev_gate_verdicts (step, verdict, reasons, doc_references, next_action)
VALUES (
  'MODULE_B.journal.js',
  'GO',
  '["17/17 tests", "91% coverage"]'::jsonb,
  '["CD 4.5", "CD 9.1"]'::jsonb,
  'B.4 atr.js'
);

UPDATE dev_pipeline_state SET current_module = 'B', current_task = 'src/journal.js', updated_at = NOW()
WHERE id = (SELECT id FROM dev_pipeline_state ORDER BY id DESC LIMIT 1);

UPDATE dev_agent_status SET status = 'idle', last_task = 'src/journal.js', last_report = NOW()
WHERE agent_id = 'coworker-1';
