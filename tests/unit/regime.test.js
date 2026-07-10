jest.mock('../../src/notify', () => ({
  notifyTelegram: jest.fn().mockResolvedValue(undefined),
  notifyN8n: jest.fn().mockResolvedValue(undefined),
}));

const { getRegime, checkTrendDown, ema } = require('../../src/regime');

describe('regime.js — CD §4.7', () => {
  // Redis LPUSH : index 0 = clôture la plus récente
  const trendUpCloses = Array.from({ length: 20 }, (_, i) => String(138 - i));
  const trendDownCloses = Array.from({ length: 20 }, (_, i) => String(100 + i));

  test('ema calcule une moyenne', () => {
    expect(ema([5, 4, 3, 2, 1], 5)).toBeGreaterThan(0);
  });

  test('getRegime TREND_UP si EMA5 > EMA20 × 1.002', async () => {
    const mockRedis = {
      lrange: jest.fn().mockResolvedValue(trendUpCloses),
      get: jest.fn().mockResolvedValue('10'),
    };
    const regime = await getRegime('BTCUSDT', mockRedis, null);
    expect(regime).toBe('TREND_UP');
  });

  test('getRegime TREND_DOWN si EMA5 < EMA20 × 0.998', async () => {
    const mockRedis = {
      lrange: jest.fn().mockResolvedValue(trendDownCloses),
      get: jest.fn().mockResolvedValue('10'),
    };
    expect(await getRegime('BTCUSDT', mockRedis, null)).toBe('TREND_DOWN');
  });

  test('getRegime VOLATILE si ATR > moyenne × 1.8', async () => {
    const mockRedis = {
      lrange: jest.fn().mockResolvedValue(trendUpCloses),
      get: jest.fn()
        .mockResolvedValueOnce('50')
        .mockResolvedValueOnce('20'),
    };
    expect(await getRegime('BTCUSDT', mockRedis, null)).toBe('VOLATILE');
  });

  test('getRegime RANGE si pas assez de clôtures', async () => {
    const mockRedis = { lrange: jest.fn().mockResolvedValue(['100', '101']) };
    expect(await getRegime('BTCUSDT', mockRedis, null)).toBe('RANGE');
  });

  test('checkTrendDown reset si pas TREND_DOWN', async () => {
    const mockRedis = { del: jest.fn().mockResolvedValue(1) };
    const r = await checkTrendDown('BTCUSDT', 'RANGE', mockRedis);
    expect(r).toEqual({ alert48h: false, alert96h: false });
    expect(mockRedis.del).toHaveBeenCalled();
  });

  test('checkTrendDown initie since si TREND_DOWN', async () => {
    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn(),
    };
    const r = await checkTrendDown('BTCUSDT', 'TREND_DOWN', mockRedis);
    expect(r.alert48h).toBe(false);
    expect(mockRedis.set).toHaveBeenCalled();
  });

  test('checkTrendDown alert48h après 48h', async () => {
    const since = Date.now() - 49 * 3600000;
    const mockRedis = {
      get: jest.fn().mockResolvedValue(String(since)),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn(),
    };
    const r = await checkTrendDown('BTCUSDT', 'TREND_DOWN', mockRedis);
    expect(r.alert48h).toBe(true);
    expect(r.alert96h).toBe(false);
  });
});
