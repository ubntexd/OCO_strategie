jest.mock('../../src/notify', () => ({
  notifyTelegram: jest.fn().mockResolvedValue(undefined),
  notifyN8n: jest.fn().mockResolvedValue(undefined),
}));

const journal = require('../../src/journal');
const { notifyTelegram } = require('../../src/notify');

describe('journal.js — CD §4.5', () => {
  describe('logTradeOpen / logTradeClose', () => {
    test('logTradeOpen retourne un id', async () => {
      const mockPg = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 42 }] }),
      };
      const id = await journal.logTradeOpen(
        mockPg, 'BTCUSDT', 104500, 0.001, 104900, 104200, 50, 0.10, 0.42,
      );
      expect(id).toBe(42);
      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO trades'),
        expect.arrayContaining(['BTCUSDT', 104500, 0.001, 0.10, 0.42]),
      );
    });

    test('logTradeClose met à jour le trade et incrémente Redis', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({}) };
      const mockRedis = { incr: jest.fn().mockResolvedValue(10) };
      await journal.logTradeClose(mockPg, mockRedis, 'BTCUSDT', 42, {
        exitPrice: 104900,
        durationMin: 5,
        pnlBrut: 0.4,
        fees: 0.01,
        pnlNet: 0.39,
        result: 'TP',
      });
      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trades'),
        expect.arrayContaining([104900, 5, 0.4, 0.01, 0.39, 'TP', 42]),
      );
      expect(mockRedis.incr).toHaveBeenCalledWith('bot:global:total_trades');
      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('daily_summary'),
        expect.any(Array),
      );
    });

    test('seuil 1500 trades déclenche notifyTelegram', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({}) };
      const mockRedis = { incr: jest.fn().mockResolvedValue(1500) };

      await journal.logTradeClose(mockPg, mockRedis, 'BTCUSDT', 1, {
        exitPrice: 1, durationMin: 1, pnlBrut: 1, fees: 0, pnlNet: 1, result: 'TP',
      });
      expect(notifyTelegram).toHaveBeenCalledWith(expect.stringContaining('1500'));
    });
  });

  describe('logEvent', () => {
    test('INSERT events SIGNAL_REJECTED', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({}) };
      await journal.logEvent(mockPg, 'BTCUSDT', 'SIGNAL_REJECTED', { reason: 'spread' });
      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        ['BTCUSDT', 'SIGNAL_REJECTED', JSON.stringify({ reason: 'spread' })],
      );
    });
  });

  describe('getDayPnl', () => {
    test('retourne la somme du jour', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({ rows: [{ total: '-12.50' }] }) };
      const pnl = await journal.getDayPnl(mockPg, 'BTCUSDT');
      expect(pnl).toBe(-12.5);
    });
  });

  describe('getConsecLoss / getTotalTrades', () => {
    test('lit Redis consec_loss', async () => {
      const mockRedis = { get: jest.fn().mockResolvedValue('3') };
      expect(await journal.getConsecLoss(mockRedis, 'BTCUSDT')).toBe(3);
    });

    test('lit Redis total_trades', async () => {
      const mockRedis = { get: jest.fn().mockResolvedValue('99') };
      expect(await journal.getTotalTrades(mockRedis)).toBe(99);
    });
  });

  describe('getProfitFactor', () => {
    test('calcule gains / pertes', async () => {
      const mockPg = {
        query: jest.fn().mockResolvedValue({
          rows: [{ pnl_net: '10' }, { pnl_net: '5' }, { pnl_net: '-4' }, { pnl_net: '-6' }],
        }),
      };
      const pf = await journal.getProfitFactor(mockPg, 'BTCUSDT');
      expect(pf).toBeCloseTo(1.5, 2);
    });
  });

  describe('logTradeFill', () => {
    test('UPDATE entry_price et qty', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({}) };
      await journal.logTradeFill(mockPg, 7, { fillPrice: 104510, quantity: 0.002 });
      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trades'),
        [104510, 0.002, 7],
      );
    });
  });

  describe('logDryRun / logSlippageAbort / logForcedExit', () => {
    test('logDryRun INSERT trade DRY_RUN', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({}) };
      await journal.logDryRun('BTCUSDT', 104500, 0.001, mockPg);
      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('DRY_RUN'),
        ['BTCUSDT', 104500, 0.001],
      );
    });

    test('logSlippageAbort INSERT event + trade', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({}) };
      await journal.logSlippageAbort('BTCUSDT', 104600, 104500, 0.25, mockPg);
      expect(mockPg.query).toHaveBeenCalledTimes(2);
    });

    test('logForcedExit INSERT event', async () => {
      const mockPg = { query: jest.fn().mockResolvedValue({}) };
      await journal.logForcedExit('BTCUSDT', 'MAX_POSITION_TIME', mockPg);
      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('FORCED_EXIT'),
        ['BTCUSDT', JSON.stringify({ reason: 'MAX_POSITION_TIME' })],
      );
    });
  });
});
