const { run } = require('../../dashboard/api/backtest');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('dashboard/api/backtest.js — C.4', () => {
  const mockPg = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPg.query.mockResolvedValue({
      rows: [
        { day: '2026-07-01', pnl: '10', trades: '2' },
        { day: '2026-07-02', pnl: '-5', trades: '1' },
      ],
    });
  });

  test('agrège PnL journalier', async () => {
    const handler = run(mockPg);
    const req = { body: { symbol: 'BTCUSDT', days: 30 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.body.symbol).toBe('BTCUSDT');
    expect(res.body.total_pnl).toBe(5);
    expect(res.body.win_days).toBe(1);
    expect(res.body.loss_days).toBe(1);
    expect(res.body.sharpe).toBeDefined();
    expect(res.body.sortino).toBeDefined();
    expect(res.body.profit_factor).toBeDefined();
    expect(res.body.daily).toHaveLength(2);
  });

  test('valeurs par défaut symbol/days', async () => {
    const handler = run(mockPg);
    const res = mockRes();
    await handler({ body: {} }, res);
    expect(res.body.days).toBe(30);
    expect(res.body.symbol).toBe('BTCUSDT');
  });
});
