const path = require('path');
const fs = require('fs');
const http = require('http');
const { createDashboardApp, buildRealtimeData } = require('../../dashboard/server');

function httpRequest(app, method, pathReq, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request({
        hostname: '127.0.0.1', port, path: pathReq, method, headers,
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close();
          let parsed = {};
          try { parsed = data && res.headers['content-type']?.includes('json') ? JSON.parse(data) : { raw: data }; } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

const authHeader = () => {
  process.env.DASHBOARD_PASSWORD = 'testpass';
  return { Authorization: `Basic ${Buffer.from('admin:testpass').toString('base64')}` };
};

describe('dashboard/server.js — 9 onglets', () => {
  const mockPg = { query: jest.fn() };
  const mockRedis = {
    get: jest.fn().mockResolvedValue('65000'),
    lrange: jest.fn().mockResolvedValue(['1', '2', '3', '4', '5', '6']),
  };

  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = 'testpass';
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({ rows: [{ total: '42.5' }] });
  });

  test('index.html expose 9 onglets', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../dashboard/public/index.html'), 'utf8');
    const tabs = (html.match(/data-tab="/g) || []).length;
    expect(tabs).toBe(9);
  });

  test('GET /health sans auth', async () => {
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('bot-dashboard');
  });

  test('GET /api/pnl/today requiert auth', async () => {
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/pnl/today');
    expect(res.status).toBe(401);
  });

  test('GET /api/pnl/today avec Basic auth', async () => {
    mockPg.query.mockResolvedValueOnce({ rows: [{ symbol: 'BTCUSDT', pnl: 10, trades: 2 }] });
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/pnl/today', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('GET /api/status', async () => {
    mockRedis.get.mockImplementation((k) => Promise.resolve(k.includes('position') ? '0' : '0'));
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/status', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pairs).toHaveLength(3);
  });

  test('GET /api/correlation', async () => {
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/correlation', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('BTCUSDT');
  });

  test('buildRealtimeData', async () => {
    mockRedis.get.mockResolvedValue('65000');
    const data = await buildRealtimeData(mockRedis, mockPg);
    expect(data.bid_btc).toBe('65000');
    expect(data.pnl_day).toBe(42.5);
  });

  test('GET /api/trades', async () => {
    mockPg.query.mockResolvedValueOnce({
      rows: [{ id: 1, symbol: 'BTCUSDT', pnl_net: 5, result: 'TP' }],
    });
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'GET', '/api/trades', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('POST /api/backtest', async () => {
    mockPg.query.mockResolvedValueOnce({
      rows: [{ day: '2026-07-01', pnl: '10', trades: '1' }],
    });
    const app = createDashboardApp(mockPg, mockRedis);
    const res = await httpRequest(app, 'POST', '/api/backtest', {
      ...authHeader(),
      'Content-Type': 'application/json',
    }, { symbol: 'BTCUSDT', days: 7 });
    expect(res.status).toBe(200);
    expect(res.body.total_pnl).toBe(10);
  });

  test('startDashboardServer démarre WebSocket', async () => {
    jest.resetModules();
    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => mockPg),
    }));
    jest.doMock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));
    const { startDashboardServer: start } = require('../../dashboard/server');
    const ctx = await start(0);
    expect(ctx.server.listening).toBe(true);
    expect(ctx.wss).toBeDefined();
    await ctx.push();
    clearInterval(ctx.interval);
    await new Promise((r) => ctx.server.close(r));
    jest.dontMock('pg');
    jest.dontMock('ioredis');
  });
});
