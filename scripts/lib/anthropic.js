/**
 * Client API Anthropic — Coworker Claude IA
 */
const https = require('https');

function callAnthropic(apiKey, body) {
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
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function extractJson(text) {
  let trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Réponse Claude vide');

  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/m, '').trim();
  }

  const tryParse = (s) => {
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('JSON racine invalide');
    }
    return obj;
  };

  try {
    return tryParse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return tryParse(match[0]);
    throw new Error('Réponse Claude non JSON');
  }
}

function normalizeGate(gate, input) {
  const verdict = gate.verdict === 'GO' ? 'GO' : 'NO_GO';
  const proofs = Array.isArray(gate.proofs) && gate.proofs.length > 0
    ? gate.proofs
    : (input.validation_report?.proofs || []);

  return {
    verdict,
    step: gate.step || input.current_step,
    reasons: Array.isArray(gate.reasons) ? gate.reasons : [String(gate.reasons || '')],
    proofs,
    doc_references: Array.isArray(gate.doc_references) ? gate.doc_references : [],
    failed_agents: Array.isArray(gate.failed_agents) ? gate.failed_agents : [],
    next_action: gate.next_action || input.next_task_hint || '',
    source: 'claude_api',
  };
}

module.exports = { callAnthropic, extractJson, normalizeGate };
