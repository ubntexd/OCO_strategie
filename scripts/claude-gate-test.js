#!/usr/bin/env node
/**
 * Test connexion API Anthropic — Coworker Claude IA (PLAN_8_AGENTS.md §3 Agent 8)
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/claude-gate-test.js
 */
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });

const https = require('https');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const FALLBACK_MODELS = [
  MODEL,
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
].filter((m, i, a) => a.indexOf(m) === i);

function callAnthropic(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: raw });
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Test connexion Coworker Claude IA ===\n');

  if (!API_KEY) {
    console.error('FAIL — ANTHROPIC_API_KEY absente');
    console.error('Ajoutez dans .env.shared : ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  console.log(`Clé API     : présente (${API_KEY.length} caractères)`);
  console.log(`Endpoint    : https://api.anthropic.com/v1/messages\n`);

  for (const model of FALLBACK_MODELS) {
    console.log(`Test modèle : ${model}`);
    const ping = await callAnthropic({
      model,
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Réponds uniquement: CONNECTED' }],
    });

    console.log(`HTTP status : ${ping.status}`);

    if (ping.status !== 200) {
      const err = ping.body.slice(0, 200);
      console.log(`Échec      : ${err}\n`);
      continue;
    }

    const parsed = JSON.parse(ping.body);
    const text = parsed.content?.[0]?.text || '';
    console.log(`Réponse     : ${text.trim()}`);
    console.log(`\nOK — Connexion Claude opérationnelle (modèle: ${model})`);
    process.exit(0);
  }

  console.error('FAIL — aucun modèle disponible avec cette clé');
  process.exit(1);
}

main().catch((err) => {
  console.error('FAIL — réseau:', err.message);
  process.exit(1);
});
