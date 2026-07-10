jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  duplicate: jest.fn().mockReturnValue({ subscribe: jest.fn(), on: jest.fn() }),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  disconnect: jest.fn(),
})));
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(),
  })),
}));
jest.mock('../../src/order', () => ({
  cancelAllOrders: jest.fn().mockResolvedValue(),
  getDecimals: jest.fn().mockReturnValue(5),
  placeEntry: jest.fn(),
  placeOPOCO: jest.fn(),
  placeOCO: jest.fn(),
  getExchangeFilters: jest.fn(),
}));
jest.mock('../../src/monitor', () => ({
  startMonitor: jest.fn().mockResolvedValue(),
  stopMonitor: jest.fn().mockResolvedValue(),
  waitForResult: jest.fn(),
}));
jest.mock('../../src/signal', () => ({
  evaluateSignal: jest.fn(),
}));
jest.mock('../../src/protection', () => ({
  isGloballyLocked: jest.fn().mockResolvedValue(false),
  isPairLocked: jest.fn().mockResolvedValue(false),
  checkPositionTimeout: jest.fn().mockResolvedValue(),
  checkAndLock: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/journal', () => ({
  logTradeOpen: jest.fn().mockResolvedValue(1),
  logTradeFill: jest.fn().mockResolvedValue(),
  logTradeClose: jest.fn().mockResolvedValue(),
  logEvent: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/atr', () => ({
  getATR: jest.fn().mockResolvedValue({ atr: 30, cached: false }),
}));
jest.mock('../../src/kelly', () => ({
  computeKellyAuto: jest.fn().mockResolvedValue(0.10),
}));
jest.mock('../../src/health', () => ({
  startHealthServer: jest.fn().mockResolvedValue(),
  stopHealthServer: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/notify', () => ({
  notifyN8n: jest.fn().mockResolvedValue(),
}));

const bot = require('../../src/bot');
const order = require('../../src/order');
const signal = require('../../src/signal');
const monitor = require('../../src/monitor');
const journal = require('../../src/journal');
const protection = require('../../src/protection');
const health = require('../../src/health');

describe('bot.js — CD §4.13', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    protection.isGloballyLocked.mockResolvedValue(false);
    protection.isPairLocked.mockResolvedValue(false);
    signal.evaluateSignal.mockResolvedValue({ ok: false, reason: 'TEST' });
  });
  test('validateRequiredEnv lève si variable manquante', () => {
    const saved = process.env.SYMBOL;
    delete process.env.SYMBOL;
    expect(() => bot.validateRequiredEnv()).toThrow('Variable manquante');
    process.env.SYMBOL = saved;
  });

  test('validateRequiredEnv OK si toutes vars présentes', () => {
    for (const key of bot.REQUIRED_ENV) {
      if (!process.env[key]) process.env[key] = 'test';
    }
    expect(() => bot.validateRequiredEnv()).not.toThrow();
  });

  test('gracefulShutdown annule ordres et nettoie Redis', async () => {
    const mockRedis = { del: jest.fn().mockResolvedValue(1) };
    const mockLogger = { info: jest.fn(), error: jest.fn() };
    await bot.gracefulShutdown('BTCUSDT', mockRedis, order, mockLogger);
    expect(order.cancelAllOrders).toHaveBeenCalledWith('BTCUSDT');
    expect(mockRedis.del).toHaveBeenCalledWith('bot:btcusdt:position_open');
  });

  test('processTradingCycle skip si signal rejeté', async () => {
    signal.evaluateSignal.mockResolvedValue({ ok: false, reason: 'SPREAD_TOO_HIGH' });
    const mockRedis = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      lrange: jest.fn().mockResolvedValue([]),
    };
    const ctx = {
      symbol: 'BTCUSDT',
      redis: mockRedis,
      pgPool: { query: jest.fn() },
      binanceClient: {},
      filters: { tickSize: 0.01, stepSize: 0.00001, opoAllowed: true },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8,
      scanInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(journal.logTradeOpen).not.toHaveBeenCalled();
  });

  test('processTradingCycle exécute trade si signal OK', async () => {
    signal.evaluateSignal.mockResolvedValue({ ok: true, reason: null });
    order.placeEntry.mockResolvedValue({
      orderId: 1, fillPrice: 100, quantity: 0.05, mode: 'LIMIT_MAKER', timestamp: Date.now(),
    });
    order.placeOPOCO.mockResolvedValue({ orderListId: 99 });
    monitor.waitForResult.mockResolvedValue({
      result: 'TP', exitPrice: 128, fees: 0.01, pnlNet: 1.4,
    });
    const mockRedis = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
    };
    const ctx = {
      symbol: 'BTCUSDT',
      redis: mockRedis,
      pgPool: { query: jest.fn() },
      binanceClient: {},
      filters: { tickSize: 0.01, stepSize: 0.00001, opoAllowed: true },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8,
      scanInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(journal.logTradeOpen).toHaveBeenCalled();
    expect(order.placeOPOCO).toHaveBeenCalled();
    expect(journal.logTradeClose).toHaveBeenCalled();
  });

  test('createBinanceClient testnet', () => {
    process.env.BINANCE_TESTNET = 'true';
    const client = bot.createBinanceClient();
    expect(client.defaults.baseURL).toContain('testnet');
  });

  test('processTradingCycle skip si globally locked', async () => {
    protection.isGloballyLocked.mockResolvedValue(true);
    const ctx = {
      symbol: 'BTCUSDT', redis: { get: jest.fn() }, pgPool: {}, binanceClient: {},
      filters: { stepSize: 0.00001, tickSize: 0.01, opoAllowed: true },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8,
      globalLockInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(signal.evaluateSignal).not.toHaveBeenCalled();
    protection.isGloballyLocked.mockResolvedValue(false);
  });

  test('processTradingCycle utilise placeOCO si opoAllowed false', async () => {
    signal.evaluateSignal.mockResolvedValue({ ok: true, reason: null });
    order.placeEntry.mockResolvedValue({
      orderId: 1, fillPrice: 100, quantity: 0.05, mode: 'LIMIT_MAKER', timestamp: Date.now(),
    });
    order.placeOCO.mockResolvedValue({ orderListId: 88 });
    monitor.waitForResult.mockResolvedValue({ result: 'TP', exitPrice: 128, fees: 0.01, pnlNet: 1.4 });
    const mockRedis = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn(), setex: jest.fn(), del: jest.fn(), incr: jest.fn(),
      lrange: jest.fn().mockResolvedValue([]),
    };
    const ctx = {
      symbol: 'BTCUSDT', redis: mockRedis, pgPool: { query: jest.fn() }, binanceClient: {},
      filters: { tickSize: 0.01, stepSize: 0.00001, opoAllowed: false },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8, scanInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(order.placeOCO).toHaveBeenCalled();
    expect(order.placeOPOCO).not.toHaveBeenCalled();
  });

  test('processTradingCycle SL appelle checkAndLock', async () => {
    signal.evaluateSignal.mockResolvedValue({ ok: true, reason: null });
    order.placeEntry.mockResolvedValue({
      orderId: 1, fillPrice: 100, quantity: 0.05, mode: 'LIMIT_MAKER', timestamp: Date.now(),
    });
    order.placeOPOCO.mockResolvedValue({ orderListId: 99 });
    monitor.waitForResult.mockResolvedValue({ result: 'SL', exitPrice: 82, fees: 0.01, pnlNet: -1 });
    const mockRedis = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn(), setex: jest.fn(), del: jest.fn(), incr: jest.fn(),
      lrange: jest.fn().mockResolvedValue([]),
    };
    const ctx = {
      symbol: 'BTCUSDT', redis: mockRedis, pgPool: { query: jest.fn() }, binanceClient: {},
      filters: { tickSize: 0.01, stepSize: 0.00001, opoAllowed: true },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8, scanInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(protection.checkAndLock).toHaveBeenCalled();
  });

  test('processTradingCycle nettoie si entry simulated', async () => {
    signal.evaluateSignal.mockResolvedValue({ ok: true, reason: null });
    order.placeEntry.mockResolvedValue({ simulated: true });
    const mockRedis = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn(), del: jest.fn(),
    };
    const ctx = {
      symbol: 'BTCUSDT', redis: mockRedis, pgPool: { query: jest.fn() }, binanceClient: {},
      filters: { tickSize: 0.01, stepSize: 0.00001, opoAllowed: true },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8, scanInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(mockRedis.del).toHaveBeenCalledWith('bot:btcusdt:position_open');
  });

  test('processTradingCycle skip si pair locked', async () => {
    protection.isPairLocked.mockResolvedValue(true);
    const ctx = {
      symbol: 'BTCUSDT', redis: { get: jest.fn() }, pgPool: {}, binanceClient: {},
      filters: { stepSize: 0.00001, tickSize: 0.01, opoAllowed: true },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8,
      pairLockInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(signal.evaluateSignal).not.toHaveBeenCalled();
  });

  test('processTradingCycle TP reset consec_loss', async () => {
    signal.evaluateSignal.mockResolvedValue({ ok: true, reason: null });
    order.placeEntry.mockResolvedValue({
      orderId: 1, fillPrice: 100, quantity: 0.05, mode: 'LIMIT_MAKER', timestamp: Date.now(),
    });
    order.placeOPOCO.mockResolvedValue({ orderListId: 99 });
    monitor.waitForResult.mockResolvedValue({ result: 'TP', exitPrice: 128, fees: 0.01, pnlNet: 1.4 });
    const mockRedis = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn(), setex: jest.fn(), del: jest.fn(), incr: jest.fn(),
      lrange: jest.fn().mockResolvedValue([]),
    };
    const ctx = {
      symbol: 'BTCUSDT', redis: mockRedis, pgPool: { query: jest.fn() }, binanceClient: {},
      filters: { tickSize: 0.01, stepSize: 0.00001, opoAllowed: true },
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      capital: 6000, tpBrut: 28, slBrut: 18, atrTpMult: 1.5, atrSlMult: 0.8, scanInterval: 10,
    };
    await bot.processTradingCycle(ctx);
    expect(mockRedis.set).toHaveBeenCalledWith('bot:btcusdt:consec_loss', '0');
  });

  test('run once cycle sans boucle infinie', async () => {
    for (const key of bot.REQUIRED_ENV) {
      process.env[key] = 'test';
    }
    process.env.SYMBOL = 'BTCUSDT';
    process.env.CAPITAL = '6000';
    process.env.TP_BRUT = '28';
    process.env.SL_BRUT = '18';
    process.env.PORT = '4001';
    process.env.BINANCE_TESTNET = 'true';
    order.getExchangeFilters.mockResolvedValue({
      tickSize: 0.01, stepSize: 0.00001, opoAllowed: true,
    });
    signal.evaluateSignal.mockResolvedValue({ ok: false, reason: 'TEST' });
    await bot.run({ once: true, scanInterval: 10 });
    expect(monitor.startMonitor).toHaveBeenCalled();
    expect(health.stopHealthServer).toHaveBeenCalled();
  }, 15000);

  test('SCAN_INTERVAL = 30000', () => {
    expect(bot.SCAN_INTERVAL).toBe(30000);
  });
});
