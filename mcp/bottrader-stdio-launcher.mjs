#!/usr/bin/env node
/**
 * Lanceur MCP stdio pour Claude Desktop — proxy vers le bridge HTTP BotTrader.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BRIDGE_URL = (process.env.BOTTRADER_BRIDGE_URL || 'http://localhost:5011').replace(/\/$/, '');
const TOKEN = process.env.BOTTRADER_MCP_TOKEN || process.env.MCP_TOKEN || '';

if (!TOKEN) {
  console.error('BOTTRADER_MCP_TOKEN manquant');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'x-mcp-token': TOKEN,
};

async function bridgePost(tool, body = {}) {
  const res = await fetch(`${BRIDGE_URL}/tools/${tool}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function bridgeGet(tool) {
  const res = await fetch(`${BRIDGE_URL}/tools/${tool}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

const TOOLS = [
  { name: 'read_file', description: 'Lire un fichier du repo BotTrader (VPS)', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'write_file', description: 'Écrire un fichier sur le VPS', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
  { name: 'list_dir', description: 'Lister un répertoire du repo', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'run_command', description: 'Exécuter une commande shell sur le VPS', inputSchema: { type: 'object', properties: { command: { type: 'string' }, timeout: { type: 'number' } }, required: ['command'] } },
  { name: 'git_status', description: 'Statut git du repo', inputSchema: { type: 'object', properties: {} } },
  { name: 'git_commit', description: 'Commit git automatique', inputSchema: { type: 'object', properties: { message: { type: 'string' } } } },
  { name: 'run_tests', description: 'Lancer npm test sur le VPS', inputSchema: { type: 'object', properties: {} } },
  { name: 'patch_file', description: 'Remplacer une chaîne dans un fichier', inputSchema: { type: 'object', properties: { path: { type: 'string' }, old_str: { type: 'string' }, new_str: { type: 'string' } }, required: ['path', 'old_str', 'new_str'] } },
];

const server = new Server(
  { name: 'bottrader', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    let result;
    if (name === 'git_status') {
      result = await bridgeGet('git_status');
    } else {
      result = await bridgePost(name, args);
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Erreur: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
