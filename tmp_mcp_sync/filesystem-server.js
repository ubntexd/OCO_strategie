#!/usr/bin/env node
/**
 * SERVEUR MCP FILESYSTEM — BotTrader v1.0
 * Lance : node mcp/filesystem-server.js
 */
'use strict';

const { spawn } = require('child_process');

const PROJECT_ROOT = process.env.BOT_PROJECT_ROOT
  || '/home/dev/dev/OCO_strategie';

const server = spawn('npx', [
  '--yes',
  '@modelcontextprotocol/server-filesystem',
  PROJECT_ROOT,
], {
  stdio: 'inherit',
  env: { ...process.env },
  shell: process.platform === 'win32',
});

server.on('error', (err) => {
  process.stderr.write(`MCP server error: ${err.message}\n`);
  process.exit(1);
});

server.on('close', (code) => {
  process.stderr.write(`MCP server exited: ${code}\n`);
  process.exit(code || 0);
});

process.on('SIGTERM', () => server.kill('SIGTERM'));
process.on('SIGINT', () => server.kill('SIGINT'));
