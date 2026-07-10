#!/usr/bin/env node
/**
 * MCP HTTP BRIDGE — BotTrader v1.0 — port 5011
 */
'use strict';

require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.env.BOT_PROJECT_ROOT
  || path.resolve(__dirname, '..');
const PORT = parseInt(process.env.MCP_HTTP_PORT || '5011', 10);
const SECRET = process.env.RESTART_SECRET || 'change-me';

const app = express();
app.use(express.json({ limit: '10mb' }));

const resolveSafe = (rel) => {
  const abs = path.resolve(PROJECT_ROOT, rel);
  if (!abs.startsWith(path.resolve(PROJECT_ROOT))) {
    throw new Error('Accès refusé');
  }
  return abs;
};

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const token = req.headers['x-mcp-token'] || req.headers['x-worker-token'];
  if (token !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-http-bridge',
    version: '1.0.0',
    project: PROJECT_ROOT,
    tools: ['read_file', 'write_file', 'list_dir', 'run_command', 'git_status', 'git_commit', 'run_tests', 'patch_file'],
  });
});

app.post('/tools/read_file', (req, res) => {
  try {
    const { path: filePath } = req.body || {};
    const abs = resolveSafe(filePath);
    const content = fs.readFileSync(abs, 'utf8');
    res.json({ path: filePath, content, lines: content.split('\n').length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/write_file', (req, res) => {
  try {
    const { path: filePath, content } = req.body || {};
    const abs = resolveSafe(filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    res.json({ status: 'ok', path: filePath, bytes: Buffer.byteLength(content) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/list_dir', (req, res) => {
  try {
    const { path: dirPath = '.' } = req.body || {};
    const abs = resolveSafe(dirPath);
    const entries = fs.readdirSync(abs, { withFileTypes: true }).map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      size: e.isFile() ? fs.statSync(path.join(abs, e.name)).size : null,
    }));
    res.json({ path: dirPath, entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/run_command', (req, res) => {
  try {
    const { command, timeout = 60000 } = req.body || {};
    const FORBIDDEN = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
    if (FORBIDDEN.some((f) => command.includes(f))) {
      return res.status(403).json({ error: 'Commande interdite' });
    }
    const output = execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout,
      env: { ...process.env },
    });
    res.json({ status: 'ok', output: output.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message, output: err.stdout });
  }
});

app.get('/tools/git_status', (_req, res) => {
  try {
    const status = execSync('git status --short', { cwd: PROJECT_ROOT, encoding: 'utf8' });
    const log = execSync('git log --oneline -5', { cwd: PROJECT_ROOT, encoding: 'utf8' });
    res.json({ status: status.trim(), log: log.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/git_commit', (req, res) => {
  try {
    const { message = 'chore: auto-commit Claude Desktop' } = req.body || {};
    execSync('git add -A', { cwd: PROJECT_ROOT });
    const out = execSync(`git commit -m "${message.replace(/"/g, '\\"')}" || echo "Rien à commiter"`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    res.json({ status: 'ok', output: out.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/run_tests', (_req, res) => {
  try {
    const out = execSync('npm test -- --coverage 2>&1', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 180000,
    });
    const pass = out.includes('Tests:') && !out.match(/Tests:.*failed/);
    const match = out.match(/Tests:\s+(\d+) passed(?:, (\d+) total)?/);
    res.json({
      status: pass ? 'pass' : 'fail',
      tests_pass: match ? parseInt(match[1], 10) : 0,
      tests_total: match ? parseInt(match[2] || match[1], 10) : 0,
      output: out.split('\n').slice(-15).join('\n'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'fail' });
  }
});

app.post('/tools/patch_file', (req, res) => {
  try {
    const { path: filePath, old_str, new_str } = req.body || {};
    const abs = resolveSafe(filePath);
    let content = fs.readFileSync(abs, 'utf8');
    if (!content.includes(old_str)) {
      return res.status(400).json({ error: 'old_str non trouvé dans le fichier' });
    }
    content = content.replace(old_str, new_str);
    fs.writeFileSync(abs, content, 'utf8');
    res.json({ status: 'ok', path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`MCP HTTP Bridge: http://0.0.0.0:${PORT}\n`);
  process.stdout.write(`Project: ${PROJECT_ROOT}\n`);
});
