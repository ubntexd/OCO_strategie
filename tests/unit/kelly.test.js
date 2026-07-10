const { computeKellyFormula, computeKellyAuto } = require('../../src/kelly');

describe('computeKellyFormula — synchrone pure', () => {
  test('formule correcte WR=60% RR=1.55', () => {
    expect(computeKellyFormula(0.60, 1.55)).toBeCloseTo(0.171, 2);
  });

  test('clamp à 0.05 minimum (WR très faible)', () => {
    expect(computeKellyFormula(0.30, 1.0)).toBe(0.05);
  });

  test('clamp à 0.20 maximum (WR très élevé)', () => {
    expect(computeKellyFormula(0.90, 5.0)).toBe(0.20);
  });
});

describe('computeKellyAuto — async avec mocks', () => {
  test('retourne 0.10 si total_trades < 100', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue('50') };
    const mockPgPool = { query: jest.fn() };
    const result = await computeKellyAuto(mockPgPool, mockRedis, 'BTCUSDT', 28, 18);
    expect(result).toBe(0.10);
    expect(mockPgPool.query).not.toHaveBeenCalled();
  });

  test('calcule WR depuis Postgres si total_trades >= 100', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue('150') };
    const rows = Array.from({ length: 100 }, (_, i) => ({ pnl_net: i < 60 ? '10' : '-8' }));
    const mockPgPool = { query: jest.fn().mockResolvedValue({ rows }) };
    const result = await computeKellyAuto(mockPgPool, mockRedis, 'BTCUSDT', 28, 18);
    expect(result).toBeCloseTo(0.171, 2);
  });
});
