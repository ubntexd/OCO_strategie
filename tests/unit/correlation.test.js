const { getPairCorrelation, shouldBlockOnCorrelation } = require('../../src/correlation');

describe('correlation.js — CD §4.8', () => {
  const prices = Array.from({ length: 20 }, (_, i) => String(100 + i));

  test('getPairCorrelation Pearson = 1 sur séries identiques', async () => {
    const mockRedis = {
      lrange: jest.fn().mockResolvedValue(prices),
    };
    const corr = await getPairCorrelation('BTCUSDT', 'ETHUSDT', 20, mockRedis);
    expect(corr).toBeCloseTo(1, 5);
  });

  test('getPairCorrelation null si données insuffisantes', async () => {
    const mockRedis = { lrange: jest.fn().mockResolvedValue(['1', '2']) };
    expect(await getPairCorrelation('BTCUSDT', 'ETHUSDT', 20, mockRedis)).toBeNull();
  });

  test('shouldBlockOnCorrelation true si corrélation haute et position ouverte', async () => {
    const mockRedis = {
      lrange: jest.fn().mockResolvedValue(prices),
      get: jest.fn().mockResolvedValue('1'),
    };
    expect(await shouldBlockOnCorrelation('BTCUSDT', mockRedis)).toBe(true);
  });

  test('shouldBlockOnCorrelation false si pas de position corrélée', async () => {
    const mockRedis = {
      lrange: jest.fn().mockResolvedValue(prices),
      get: jest.fn().mockResolvedValue(null),
    };
    expect(await shouldBlockOnCorrelation('BTCUSDT', mockRedis)).toBe(false);
  });
});
