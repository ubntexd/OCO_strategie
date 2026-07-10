jest.mock('../../src/notify', () => ({
  notifyTelegram: jest.fn().mockResolvedValue(undefined),
  notifyN8n: jest.fn().mockResolvedValue(undefined),
}));

const protection = require('../../src/protection');
const journal = require('../../src/journal');

describe('protection.js — CD §4.12', () => {
  beforeEach(() => {
    process.env.MAX_CONSEC_LOSS = '3';
    process.env.MAX_LOSS_DAY = '60';
    process.env.MAX_POSITION_HOURS = '4';
  });

  test('isGloballyLocked true si bot:global:stop', async () => {
    const redis = { get: jest.fn().mockResolvedValue('1') };
    expect(await protection.isGloballyLocked(redis)).toBe(true);
  });

  test('isPairLocked true si daily_loss_locked', async () => {
    const redis = { get: jest.fn().mockResolvedValue('1') };
    expect(await protection.isPairLocked('BTCUSDT', redis)).toBe(true);
  });

  test('resetDailyLocks supprime verrous', async () => {
    const redis = { del: jest.fn(), set: jest.fn() };
    await protection.resetDailyLocks('BTCUSDT', redis);
    expect(redis.del).toHaveBeenCalled();
  });

  test('checkAndLock lock après 3 pertes consécutives', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(3), set: jest.fn() };
    const pgPool = { query: jest.fn() };
    jest.spyOn(journal, 'getDayPnl').mockResolvedValue(0);
    await protection.checkAndLock('BTCUSDT', redis, pgPool);
    expect(redis.set).toHaveBeenCalledWith('bot:btcusdt:daily_loss_locked', '1');
    journal.getDayPnl.mockRestore();
  });

  test('checkAndLock stop global si perte totale > 120', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(1), set: jest.fn() };
    const pgPool = { query: jest.fn() };
    jest.spyOn(journal, 'getDayPnl').mockResolvedValue(-50);
    await protection.checkAndLock('BTCUSDT', redis, pgPool);
    expect(redis.set).toHaveBeenCalledWith('bot:global:stop', '1');
    journal.getDayPnl.mockRestore();
  });

  test('checkAndLock lock perte journalière', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(1), set: jest.fn() };
    const pgPool = { query: jest.fn() };
    jest.spyOn(journal, 'getDayPnl')
      .mockResolvedValueOnce(-70)
      .mockResolvedValue(-10)
      .mockResolvedValue(-10)
      .mockResolvedValue(-10);
    await protection.checkAndLock('BTCUSDT', redis, pgPool);
    expect(redis.set).toHaveBeenCalledWith('bot:btcusdt:daily_loss_locked', '1');
    journal.getDayPnl.mockRestore();
  });

  test('checkPositionTimeout ferme position trop longue', async () => {
    const old = Date.now() - 5 * 3600000;
    const redis = {
      get: jest.fn()
        .mockResolvedValueOnce(String(old))
        .mockResolvedValueOnce('0.01'),
      del: jest.fn(),
    };
    const orderManager = { placeMarketSell: jest.fn().mockResolvedValue({}) };
    jest.spyOn(journal, 'logForcedExit').mockResolvedValue();
    await protection.checkPositionTimeout('BTCUSDT', redis, orderManager);
    expect(orderManager.placeMarketSell).toHaveBeenCalled();
    journal.logForcedExit.mockRestore();
  });
});
