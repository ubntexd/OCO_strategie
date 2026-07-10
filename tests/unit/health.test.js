jest.mock('../../src/journal', () => ({
  getDayPnl: jest.fn().mockResolvedValue(0),
  getConsecLoss: jest.fn().mockResolvedValue(0),
}));

const http = require('http');
const { createHealthApp } = require('../../src/health');

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
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe('health.js — CD §4.4', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue('0'),
    del: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    publish: jest.fn().mockResolvedValue(1),
  };
  const mockPg = {
    query: jest.fn().mockResolvedValue({ rows: [{ last: null }] }),
  };

  beforeEach(() => {
    process.env.SYMBOL = 'BTCUSDT';
    process.env.RESTART_SECRET = 'test-secret';
    process.env.DRY_RUN = 'true';
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({ rows: [{ last: null }] });
  });

  test('GET /health retourne status ok', async () => {
    const app = createHealthApp(mockRedis, mockPg);
    const res = await httpRequest(app, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.symbol).toBe('BTCUSDT');
  });

  test('GET /status retourne métriques', async () => {
    mockPg.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    const app = createHealthApp(mockRedis, mockPg);
    const res = await httpRequest(app, 'GET', '/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pnl_day');
    expect(res.body.dry_run).toBe(true);
  });

  test('POST /restart refuse token invalide', async () => {
    const app = createHealthApp(mockRedis, mockPg);
    const res = await httpRequest(app, 'POST', '/restart', {});
    expect(res.status).toBe(401);
  });

  test('POST /config reset_daily', async () => {
    const app = createHealthApp(mockRedis, mockPg);
    const res = await httpRequest(app, 'POST', '/config', {
      'Content-Type': 'application/json',
      'x-bot-token': 'test-secret',
    }, { key: 'reset_daily' });
    expect(res.status).toBe(200);
    expect(res.body.key).toBe('reset_daily');
    expect(mockRedis.del).toHaveBeenCalled();
  });

  test('POST /restart OK avec token valide', async () => {
    jest.useFakeTimers();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const app = createHealthApp(mockRedis, mockPg);
    const res = await httpRequest(app, 'POST', '/restart', { 'x-restart-token': 'test-secret' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('restarting');
    jest.advanceTimersByTime(600);
    exitSpy.mockRestore();
    jest.useRealTimers();
  });

  test('POST /config publie config Redis', async () => {
    const app = createHealthApp(mockRedis, mockPg);
    const res = await httpRequest(app, 'POST', '/config', {
      'Content-Type': 'application/json',
      'x-bot-token': 'test-secret',
    }, { key: 'MAX_SPREAD', value: '2' });
    expect(res.status).toBe(200);
    expect(mockRedis.publish).toHaveBeenCalled();
  });

  test('startHealthServer et stopHealthServer', async () => {
    const { startHealthServer, stopHealthServer } = require('../../src/health');
    await startHealthServer(0, mockRedis, mockPg);
    await stopHealthServer();
  });
});
