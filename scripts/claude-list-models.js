#!/usr/bin/env node
require('dotenv').config({ path: process.env.ENV_FILE || '.env.shared' });
const https = require('https');

const API_KEY = process.env.ANTHROPIC_API_KEY;

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path,
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

get('/v1/models').then((r) => {
  console.log('GET /v1/models status:', r.status);
  console.log(r.body.slice(0, 2000));
}).catch((e) => console.error(e.message));
