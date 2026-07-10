const http = require('http');
const { validateSelectOnly, validateConfigParam, ALLOWED_PARAMS } = require('../../mcp/lib/sqlGuard');
const { getPnl, runQuery, setConfig } = require('../../mcp/lib/tools');
const { createMcpApp } = require('../../mcp/server');

function httpRequest(app, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request({
        hostname: '127.0.0.1', port, path, method, headers,
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close();
          let parsed = {};
          try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe('sqlGuard — L14', () => {
  test('SELECT valide accepté', () => {
    const r = validateSelectOnly('SELECT 1');
    expect(r.ok).toBe(true);
  });

  test('bloque DROP', () => {
    const r = validateSelectOnly('SELECT 1; DROP TABLE trades');
    expect(r.ok).toBe(false);
  });

  test('bloque UPDATE', () => {
    const r = validateSelectOnly('UPDATE trades SET pnl_net=0');
    expect(r.ok).toBe(false);
  });

  test('bloque injection point-virgule', () => {
    const r = validateSelectOnly('SELECT 1; DELETE FROM trades');
    expect(r.ok).toBe(false);
  });

  test('whitelist ALLOWED_PARAMS', () => {
    expect(validateConfigParam('MAX_SPREAD').ok).toBe(true);
    expect(validateConfigParam('HACK_PARAM').ok).toBe(false);
    expect(ALLOWED_PARAMS).toContain('TP_BRUT');
  });
});

describe('tools.js — L14', () => {
  const mockPg = { query: jest.fn() };
  const mockRedis = { publish: jest.fn().mockResolvedValue(1) };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({ rows: [{ symbol: 'BTCUSDT', pnl: 10 }] });
  });

  test('getPnl agrège par symbole', async () => {
    const rows = await getPnl(mockPg, { symbol: 'BTCUSDT', period: 'today' });
    expect(rows).toHaveLength(1);
    expect(mockPg.query).toHaveBeenCalled();
  });

  test('runQuery log mcp_actions', async () => {
    mockPg.query
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const out = await runQuery(mockPg, 'SELECT 1');
    expect(out.rows).toHaveLength(1);
    expect(mockPg.query).toHaveBeenCalledWith(
      expect.stringContaining('mcp_actions'),
      expect.any(Array),
    );
  });

  test('runQuery rejette SQL non SELECT', async () => {
    const out = await runQuery(mockPg, 'DROP TABLE trades');
    expect(out.error).toMatch(/SELECT/);
  });

  test('setConfig publie Redis et log', async () => {
    const out = await setConfig(mockRedis, mockPg, {
      symbol: 'BTCUSDT', param: 'MAX_SPREAD', value: '1.5',
    });
    expect(out.message).toMatch(/MAX_SPREAD/);
    expect(mockRedis.publish).toHaveBeenCalled();
    expect(mockPg.query).toHaveBeenCalledWith(
      expect.stringContaining('mcp_actions'),
      expect.any(Array),
    );
  });

  test('setConfig rejette param hors whitelist', async () => {
    const out = await setConfig(mockRedis, mockPg, {
      symbol: 'BTCUSDT', param: 'EVIL', value: '1',
    });
    expect(out.error).toMatch(/non autorisé/);
  });
});

describe('mcp/server.js — L14', () => {
  const mockPg = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const mockRedis = { publish: jest.fn().mockResolvedValue(1) };

  beforeEach(() => {
    process.env.MCP_TOKEN = 'test-mcp-token';
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({ rows: [] });
  });

  test('GET /health sans auth', async () => {
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('bot-mcp');
  });

  test('POST /tools/run_query sans token → 401', async () => {
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/run_query', {}, { sql: 'SELECT 1' });
    expect(res.status).toBe(401);
  });

  test('POST /tools/run_query avec token', async () => {
    mockPg.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/run_query', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { sql: 'SELECT 1' });
    expect(res.status).toBe(200);
    expect(res.body.rows).toBeDefined();
  });

  test('POST /tools/get_pnl avec token', async () => {
    mockPg.query.mockResolvedValueOnce({ rows: [{ symbol: 'BTCUSDT', pnl: 1 }] });
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/get_pnl', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT' });
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  test('POST /tools/set_config avec token', async () => {
    mockPg.query.mockResolvedValueOnce({ rowCount: 1 });
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/set_config', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT', param: 'MAX_SPREAD', value: '1.5' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/MAX_SPREAD/);
  });

  test('POST /tools/set_config param invalide → 400', async () => {
    const app = createMcpApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/tools/set_config', {
      'x-mcp-token': 'test-mcp-token',
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT', param: 'EVIL', value: '1' });
    expect(res.status).toBe(400);
  });

  test('startMcpServer démarre le listener', async () => {
    jest.resetModules();
    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => mockPg),
    }));
    jest.doMock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));
    const { startMcpServer } = require('../../mcp/server');
    const ctx = await startMcpServer(0);
    expect(ctx.server.listening).toBe(true);
    await new Promise((r) => ctx.server.close(r));
    jest.dontMock('pg');
    jest.dontMock('ioredis');
  });
});
