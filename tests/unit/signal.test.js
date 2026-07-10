jest.mock('../../src/atr', () => ({
  getATR: jest.fn().mockResolvedValue({ atr: 50, cached: false }),
}));
jest.mock('../../src/regime', () => ({
  getRegime: jest.fn().mockResolvedValue('TREND_UP'),
}));
jest.mock('../../src/correlation', () => ({
  shouldBlockOnCorrelation: jest.fn().mockResolvedValue(false),
}));

const signal = require('../../src/signal');
const journal = require('../../src/journal');
const atrMod = require('../../src/atr');
const regimeMod = require('../../src/regime');
const correlationMod = require('../../src/correlation');

describe('signal.js — CD §4.9', () => {
  const mockPg = { query: jest.fn().mockResolvedValue({ rows: [{ total: '0' }] }) };
  const baseRedis = () => ({
    get: jest.fn().mockImplementation(async (key) => {
      if (key.includes('consec_loss')) return '0';
      if (key.includes('trades_day')) return '0';
      if (key.includes('bid:')) return '100';
      if (key.includes('ask:')) return '100.5';
      if (key.includes('volume_current')) return '1000';
      if (key.includes('volume_avg')) return '1000';
      if (key.includes('atr_avg')) return '50';
      if (key.startsWith('liq:')) return null;
      if (key.startsWith('bot:global')) return null;
      if (key.includes('daily_loss')) return null;
      return null;
    }),
    lrange: jest.fn().mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => String(138 - i)),
    ),
  });

  beforeEach(() => {
    process.env.MAX_SPREAD = '1.5';
    process.env.MAX_TRADES_DAY = '6';
    process.env.MAX_CONSEC_LOSS = '3';
    process.env.MAX_LOSS_DAY = '60';
    process.env.TRADING_HOURS_START = '00:00';
    process.env.TRADING_HOURS_END = '23:59';
    jest.spyOn(journal, 'getDayPnl').mockResolvedValue(0);
    jest.spyOn(journal, 'logEvent').mockResolvedValue();
    atrMod.getATR.mockResolvedValue({ atr: 50, cached: false });
    regimeMod.getRegime.mockResolvedValue('TREND_UP');
    correlationMod.shouldBlockOnCorrelation.mockResolvedValue(false);
  });

  afterEach(() => {
    journal.getDayPnl.mockRestore();
    journal.logEvent.mockRestore();
  });

  test('signal OK si tous filtres passent', async () => {
    const r = await signal.evaluateSignal('BTCUSDT', baseRedis(), {}, mockPg);
    expect(r).toEqual({ ok: true, reason: null });
  });

  test('GLOBAL_STOP', async () => {
    const redis = baseRedis();
    redis.get = jest.fn().mockImplementation(async (key) => {
      if (key === 'bot:global:stop') return '1';
      return null;
    });
    const r = await signal.evaluateSignal('BTCUSDT', redis, {}, mockPg);
    expect(r.reason).toBe('GLOBAL_STOP');
  });

  test('MAX_CONSEC_LOSS', async () => {
    const redis = baseRedis();
    redis.get = jest.fn().mockImplementation(async (key) => {
      if (key.includes('consec_loss')) return '3';
      if (key === 'bot:global:stop') return null;
      return null;
    });
    const r = await signal.evaluateSignal('BTCUSDT', redis, {}, mockPg);
    expect(r.reason).toBe('MAX_CONSEC_LOSS');
  });

  test('SPREAD_TOO_HIGH', async () => {
    const redis = baseRedis();
    redis.get = jest.fn().mockImplementation(async (key) => {
      if (key.includes('bid:')) return '100';
      if (key.includes('ask:')) return '105';
      if (key.includes('consec_loss')) return '0';
      if (key.includes('trades_day')) return '0';
      return null;
    });
    const r = await signal.evaluateSignal('BTCUSDT', redis, {}, mockPg);
    expect(r.reason).toBe('SPREAD_TOO_HIGH');
  });

  test('TREND_DOWN', async () => {
    regimeMod.getRegime.mockResolvedValue('TREND_DOWN');
    const r = await signal.evaluateSignal('BTCUSDT', baseRedis(), {}, mockPg);
    expect(r.reason).toBe('TREND_DOWN');
  });

  test('CORRELATION_BLOCK', async () => {
    correlationMod.shouldBlockOnCorrelation.mockResolvedValue(true);
    const r = await signal.evaluateSignal('BTCUSDT', baseRedis(), {}, mockPg);
    expect(r.reason).toBe('CORRELATION_BLOCK');
  });

  test('MAX_LOSS_DAY', async () => {
    journal.getDayPnl.mockResolvedValue(-70);
    const r = await signal.evaluateSignal('BTCUSDT', baseRedis(), {}, mockPg);
    expect(r.reason).toBe('MAX_LOSS_DAY');
  });

  test('DAILY_LOSS_LOCKED', async () => {
    const redis = baseRedis();
    redis.get = jest.fn().mockImplementation(async (key) => {
      if (key.includes('daily_loss_locked')) return '1';
      if (key === 'bot:global:stop') return null;
      return null;
    });
    const r = await signal.evaluateSignal('BTCUSDT', redis, {}, mockPg);
    expect(r.reason).toBe('DAILY_LOSS_LOCKED');
  });

  test('MAX_TRADES_DAY', async () => {
    const redis = baseRedis();
    redis.get = jest.fn().mockImplementation(async (key) => {
      if (key.includes('trades_day')) return '6';
      if (key.includes('consec_loss')) return '0';
      return null;
    });
    const r = await signal.evaluateSignal('BTCUSDT', redis, {}, mockPg);
    expect(r.reason).toBe('MAX_TRADES_DAY');
  });
});
