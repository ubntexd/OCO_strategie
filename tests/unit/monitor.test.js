jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: { listenKey: 'test-listen-key' } }),
  put: jest.fn().mockResolvedValue({}),
}));

jest.mock('ws', () => jest.fn().mockImplementation(() => ({
  on: jest.fn((event, cb) => {
    if (event === 'open') setImmediate(cb);
  }),
  close: jest.fn(),
  readyState: 1,
})));

const {
  waitForResult, handleExecutionReport, handleBookTicker, handleKline,
  startMonitor, stopMonitor,
} = require('../../src/monitor');

describe('monitor.js — CD §4.11', () => {
  describe('waitForResult', () => {
    test('retourne le résultat dès que Redis est alimenté', async () => {
      const mockData = JSON.stringify({
        result: 'TP', exitPrice: 104932, quantity: 0.0572, fees: 0.008,
      });
      let callCount = 0;
      const mockRedis = {
        get: jest.fn().mockImplementation(async () => {
          callCount += 1;
          return callCount >= 3 ? mockData : null;
        }),
        del: jest.fn().mockResolvedValue(1),
      };
      const result = await waitForResult(12345, mockRedis, 5000);
      expect(result.result).toBe('TP');
      expect(result.exitPrice).toBe(104932);
    });

    test('throw après timeout', async () => {
      const mockRedis = { get: jest.fn().mockResolvedValue(null), del: jest.fn() };
      await expect(waitForResult(99999, mockRedis, 600)).rejects.toThrow('waitForResult timeout');
    });
  });

  describe('handleExecutionReport', () => {
    test('fill entrée si orderListId === -1', async () => {
      const mockRedis = { setex: jest.fn().mockResolvedValue('OK') };
      await handleExecutionReport({
        orderId: 42, orderListId: -1, status: 'FILLED',
        side: 'BUY', price: '100', executedQty: '0.01', commission: '0',
      }, mockRedis);
      expect(mockRedis.setex).toHaveBeenCalledWith('fill:42', 120, expect.any(String));
    });

    test('result TP si price >= tpPrice', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue('104900'),
        setex: jest.fn().mockResolvedValue('OK'),
      };
      await handleExecutionReport({
        orderId: 1, orderListId: 100, status: 'FILLED',
        side: 'SELL', price: '104932', executedQty: '0.01', commission: '0.01',
      }, mockRedis);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'result:100', 300,
        expect.stringContaining('"result":"TP"'),
      );
    });

    test('result SL si price < tpPrice', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue('104900'),
        setex: jest.fn().mockResolvedValue('OK'),
      };
      await handleExecutionReport({
        orderId: 1, orderListId: 100, status: 'FILLED',
        side: 'SELL', price: '104800', executedQty: '0.01', commission: '0.01',
      }, mockRedis);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'result:100', 300,
        expect.stringContaining('"result":"SL"'),
      );
    });
  });

  describe('handleBookTicker', () => {
    test('stocke bid/ask Redis', async () => {
      const mockRedis = { set: jest.fn().mockResolvedValue('OK') };
      await handleBookTicker({ b: '100', a: '101' }, 'BTCUSDT', mockRedis);
      expect(mockRedis.set).toHaveBeenCalledWith('bid:BTCUSDT', '100');
      expect(mockRedis.set).toHaveBeenCalledWith('ask:BTCUSDT', '101');
    });
  });

  describe('handleKline', () => {
    test('ignore si kline non fermée', async () => {
      const mockRedis = { lpush: jest.fn(), ltrim: jest.fn(), set: jest.fn() };
      await handleKline({ k: { x: false, c: '105', v: '1000' } }, 'BTCUSDT', mockRedis);
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    test('lpush closes si kline fermée', async () => {
      const mockRedis = {
        lpush: jest.fn().mockResolvedValue(1),
        ltrim: jest.fn().mockResolvedValue('OK'),
        set: jest.fn().mockResolvedValue('OK'),
      };
      await handleKline({ k: { x: true, c: '105', v: '1000' } }, 'BTCUSDT', mockRedis);
      expect(mockRedis.lpush).toHaveBeenCalledWith('closes:BTCUSDT', '105');
      expect(mockRedis.ltrim).toHaveBeenCalledWith('closes:BTCUSDT', 0, 49);
    });
  });

  describe('startMonitor / stopMonitor', () => {
    test('démarre et arrête les WebSockets', async () => {
      process.env.BINANCE_API_KEY = 'test-key';
      const mockRedis = { set: jest.fn(), lpush: jest.fn(), ltrim: jest.fn() };
      await startMonitor('BTCUSDT', mockRedis);
      await stopMonitor();
    });

    test('WS message invalide loggue erreur', async () => {
      const Ws = require('ws');
      process.env.BINANCE_API_KEY = 'test-key';
      const mockRedis = { set: jest.fn(), lpush: jest.fn(), ltrim: jest.fn() };
      await startMonitor('BTCUSDT', mockRedis);
      const wsInst = Ws.mock.results[0].value;
      const msgCb = wsInst.on.mock.calls.find((c) => c[0] === 'message')[1];
      await msgCb(Buffer.from('not-json'));
      await stopMonitor();
    });
  });
});
