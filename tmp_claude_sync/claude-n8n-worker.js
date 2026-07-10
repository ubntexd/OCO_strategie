#!/usr/bin/env node
/**
 * WORKER N8N → CLAUDE CODE — ROHAN BotTrader v1.0
 * Lance : node scripts/claude-n8n-worker.js
 */

'use strict';

require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const { execSync, spawn } = require('child_process');
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.CLAUDE_WORKER_PORT || '4099', 10);
const SECRET = process.env.RESTART_SECRET || 'change-me';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'claude-worker.log');

const app = express();
app.use(express.json());

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, line);
  process.stdout.write(line);
};

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const token = req.headers['x-worker-token'];
  if (token !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'claude-n8n-worker',
    version: '1.0.0',
    project: PROJECT_ROOT,
    claude_cli: !!process.env.ANTHROPIC_API_KEY,
  });
});

app.post('/execute', async (req, res) => {
  const { instruction, async: isAsync = false } = req.body || {};
  if (!instruction) return res.status(400).json({ error: 'instruction manquante' });

  log(`EXECUTE: ${String(instruction).slice(0, 100)}`);

  if (isAsync) {
    res.json({ status: 'queued', instruction });
    runClaude(instruction).catch((e) => log(`ASYNC ERR: ${e.message}`));
    return;
  }

  try {
    const result = await runClaude(instruction);
    res.json({ status: 'ok', result });
  } catch (err) {
    log(`ERR: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/commit', (req, res) => {
  const { message = 'chore: auto-commit depuis N8n' } = req.body || {};
  try {
    const out = execSync(
      `cd "${PROJECT_ROOT}" && git add -A && git commit -m "${message.replace(/"/g, '\\"')}" || echo "Rien à commiter"`,
      { encoding: 'utf8' },
    );
    log(`COMMIT: ${message}`);
    res.json({ status: 'ok', output: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/test', (_req, res) => {
  try {
    const out = execSync(
      `cd "${PROJECT_ROOT}" && npm test -- --coverage 2>&1 | tail -30`,
      { encoding: 'utf8', timeout: 120000 },
    );
    const pass = out.includes('Tests:') && !out.match(/Tests:.*failed/);
    log(`TEST: ${pass ? 'PASS' : 'FAIL'}`);
    res.json({ status: pass ? 'pass' : 'fail', output: out });
  } catch (err) {
    res.status(500).json({ error: err.message, output: err.stdout });
  }
});

function runClaude(instruction) {
  return new Promise((resolve, reject) => {
    const context = `Projet : BotTrader v1.0 — ROHAN Innovation
Repo : ${PROJECT_ROOT}
Règles : npm test avant commit, zéro intervention humaine, CommonJS, winston uniquement.

INSTRUCTION : ${instruction}`;

    const proc = spawn('claude', ['--print', '--dangerously-skip-permissions'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      shell: process.platform === 'win32',
    });

    proc.stdin.write(context);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Claude exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

app.listen(PORT, () => {
  log(`Worker démarré sur port ${PORT}`);
  log(`Health: http://localhost:${PORT}/health`);
});
